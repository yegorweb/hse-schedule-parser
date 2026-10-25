import { execFileSync, execSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectRoot, '.output', 'public');
const dryRun = process.argv.includes('--dry-run');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
}

async function main() {
  execSync('npm run generate', { cwd: projectRoot, stdio: 'inherit' });

  const indexHtml = await readFile(join(outputDirectory, 'index.html'), 'utf8');
  if (!indexHtml) {
    throw new Error(`Static output is missing or empty: ${outputDirectory}`);
  }

  const remoteUrl = run('git', ['remote', 'get-url', 'origin']).trim();
  const remoteRef = run(
    'git',
    ['ls-remote', '--heads', 'origin', 'refs/heads/pages'],
  ).trim();
  const expectedRemoteSha = remoteRef ? remoteRef.split(/\s+/)[0] : '';
  const publishDirectory = await mkdtemp(join(tmpdir(), 'hse-schedule-pages-'));

  try {
    await cp(outputDirectory, publishDirectory, { recursive: true });
    await writeFile(join(publishDirectory, '.nojekyll'), '');

    run('git', ['init', '-b', 'pages'], { cwd: publishDirectory });
    run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: publishDirectory });
    run('git', ['add', '--all'], { cwd: publishDirectory });
    run(
      'git',
      [
        '-c',
        'user.name=GitHub Pages deploy',
        '-c',
        'user.email=pages-deploy@users.noreply.github.com',
        'commit',
        '-m',
        'Deploy static site',
      ],
      { cwd: publishDirectory, stdio: 'inherit' },
    );

    if (dryRun) {
      console.log('Dry run complete. Static files were generated; the push was skipped.');
      return;
    }

    run(
      'git',
      [
        'push',
        `--force-with-lease=refs/heads/pages:${expectedRemoteSha}`,
        'origin',
        'HEAD:refs/heads/pages',
      ],
      { cwd: publishDirectory, stdio: 'inherit' },
    );
    console.log('Published static site to origin/pages.');
  } finally {
    await rm(publishDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('GitHub Pages deployment failed.');
  console.error(error);
  process.exitCode = 1;
});
