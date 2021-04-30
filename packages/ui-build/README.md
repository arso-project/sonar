#@arsonar/ui-build

A lightweight build tool for JavaScript.

Based on [estrella](https://github.com/rsms/estrella), a lightweight and versatile build tool based on the fantastic [esbuild](https://github.com/evanw/esbuild) TypeScript and JavaScript compiler.

This module adds:

- A simple live-reloading development server
- A way to copy assets recursively

## Module usage

```javascript
require { run } from '@arsonar/ui-build'
run({
  outfile,
  entry,
  assets,
  // ...
})
```

See estrella docs (above) for options.

## CLI usage

```
ui-build [options] <ENTRY>
```

When called without arguments, the first file present in the following list will be used as entry file: `main.js`, `src/main.js`, `index.js`, `src/index.js`. The same paths are also checked for `jsx`, `ts`, and `tsx` extensions. By default the bundle is written to `build/bundle.js`. If the `-c` option is set, a folder called `static` or `assets` will be copied into the directory of the output file.

#### Options

```
-w, -watch           Watch source files for changes and rebuild.
-g, -debug           Do not optimize and define DEBUG=true.
-r, -run             Run the output file after a successful build.
-sourcemap           Generate sourcemap.
-inline-sourcemap    Generate inline sourcemap.
-no-color            Disable use of colors.
-no-clear            Disable clearing of the screen, regardless of TTY status.
-no-diag             Disable TypeScript diagnostics.
-color               Color terminal output, regardless of TTY status.
-diag                Only run TypeScript diagnostics (no esbuild.)
-quiet               Only log warnings and errors but nothing else.
-silent              Don't log anything, not even errors.
-estrella-version    Print version of estrella and exit 0.
-estrella-debug      Enable debug logging of estrella itself.
-b=,-base=<path>     Basedir for entry and outdir
-e, -entry           Entry file
-o=,-outfile=<path>  Path to write output bundle to (default: build/bundle.js)
-no-serve            Don't start a development server in watch mode
-a=,-assets=<path>   Path to static assets to copy to build folder
-c, -copy            Copy static assets into outdir
-m, -minify          Minify javascript
-host=<host>         Development server: Hostname
-port=<port>         Development server: Port

```


