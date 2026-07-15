import { codegen, cssgen, loadConfigAndCreateContext } from '@pandacss/node';

const cwd = process.cwd();

try {
    const context = await loadConfigAndCreateContext({ cwd });
    const result = await codegen(context);
    if (result.msg) console.log(result.msg);
    await cssgen(context, { cwd, outfile: 'src/app/styles/panda.css' });

    // Panda leaves its esbuild service open when driven through Node 26.
    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}
