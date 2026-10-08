import { Command } from 'commander';
import pc from 'picocolors';
import { defaultRegistry } from './checks/registry.js';
import { DoctorEngine } from './engine.js';
import { formatJsonReport } from './reporters/json.js';
import { formatMarkdownReport } from './reporters/markdown.js';
import { formatTextReport } from './reporters/text.js';

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('stellar-anchor-doctor')
    .description('Diagnostic scanner and health auditor for live Stellar Anchor deployments')
    .version('1.0.0');

  program
    .argument('[domain]', 'Anchor domain to audit (e.g. anchor.example.com)')
    .option('-f, --format <format>', 'Output format: text, json, or markdown', 'text')
    .option('--strict', 'Treat warnings as errors and exit with code 1', false)
    .option('--skip <checks>', 'Comma-separated check IDs to skip (e.g. sep-38,sep-6)')
    .option('--timeout <ms>', 'Network request timeout in milliseconds', '8000')
    .option('--testnet', 'Audit against Stellar Testnet network passphrase', false)
    .option('-q, --quiet', 'Only print summary diagnostics', false)
    .option('--no-color', 'Disable colored terminal output')
    .action(async (domain, options) => {
      if (!domain) {
        program.help();
        return;
      }

      const skip = options.skip ? options.skip.split(',').map((s: string) => s.trim()) : [];
      const timeout = parseInt(options.timeout, 10) || 8000;

      const engine = new DoctorEngine();
      try {
        const report = await engine.runAudit({
          domain,
          format: options.format,
          strict: options.strict,
          skip,
          timeout,
          testnet: options.testnet,
          quiet: options.quiet,
          color: options.color,
        });

        if (options.format === 'json') {
          console.log(formatJsonReport(report));
        } else if (options.format === 'markdown') {
          console.log(formatMarkdownReport(report));
        } else {
          console.log(formatTextReport(report, options.color));
        }

        // Determine exit code
        if (report.summary.error > 0) {
          process.exitCode = 1;
        } else if (options.strict && report.summary.warn > 0) {
          process.exitCode = 1;
        } else {
          process.exitCode = 0;
        }
      } catch (err: any) {
        console.error(pc.red(`\n✖ Fatal Error: ${err.message}`));
        process.exitCode = 2;
      }
    });

  program
    .command('list-checks')
    .description('List all available diagnostic checks')
    .action(() => {
      console.log(pc.bold('\nRegistered Diagnostic Checks:\n'));
      for (const check of defaultRegistry.getAll()) {
        console.log(`  ${pc.bold(pc.cyan(check.id.padEnd(10)))} ${pc.bold(check.name)}`);
        console.log(`  ${' '.repeat(10)} ${pc.dim(check.description)}`);
        console.log(`  ${' '.repeat(10)} ${pc.dim(`Spec: ${check.specUrl}`)}\n`);
      }
    });

  await program.parseAsync(argv);
}
