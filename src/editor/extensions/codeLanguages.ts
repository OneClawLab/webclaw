import { LanguageDescription } from "@codemirror/language"

import { markdown } from "@hack/codemirror/lang-markdown/index.js"
import { javascript } from "@codemirror/lang-javascript"
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'

export const theCodeLanguages = [
  LanguageDescription.of({
    name: "markdown",
    alias: ["md", "mdx", "markdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext"],
    load: async () => {
      return markdown();
    }
  }),
  // JavaScript 家族
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "ts", "jsx", "tsx", "typescript", "mjs", "cjs", "mts", "cts"],
    load: async () => {
      // await import("@codemirror/lang-javascript").then(m => m.javascript({jsx: true, typescript: true}))
      return javascript( { jsx: true, typescript: true } );
    }
  }),
  // Python
  LanguageDescription.of({
    name: "python",
    alias: ["py", "pyw", "pyx", "pxd", "pxi", "pyt", "pyi", "ipy"],
    load: async () => {
      // await import('@codemirror/lang-python');
      return python();
    }
  }),
  LanguageDescription.of({
    name: "css",
    alias: ["css", "scss", "less", "pcss", "postcss", "sass"],
    load: async () => {
      // await import('@codemirror/lang-css');
      return css();
    }
  }),
  LanguageDescription.of({
    name: "json",
    alias: ["jsonc", "json5", "geojson", "topojson"],
    load: async () => {
      // await import('@codemirror/lang-json');
      return json();
    }
  }),
  LanguageDescription.of({
    name: "html",
    alias: ["html", "htm", "xhtml", "vue", "svelte"],
    load: async () => {
      // await import('@codemirror/lang-html');
      return html();
    }
  }),
  LanguageDescription.of({
    name: "xml",
    alias: ["svg", "xhtml", "rss", "wsdl", "xsl", "xsd"],
    load: async () => {
      // await import('@codemirror/lang-xml');
      return xml();
    }
  }),
  LanguageDescription.of({
    name: "yaml",
    alias: ["yml"],
    load: async () => {
      // await import('@codemirror/lang-yaml');
      return yaml();
    }
  }),
  LanguageDescription.of({
    name: "java",
    alias: ["java", "jav","jsp", "jspx"],
    load: async () => {
      // await import('@codemirror/lang-java');
      return java();
    }
  }),
  LanguageDescription.of({
    name: "cpp",
    alias: ["cpp", "c", "h", "hpp", "cc", "cxx", "hh", "hxx"],
    load: async () => {
      // await import('@codemirror/lang-cpp');
      return cpp();
    }
  }),
];

