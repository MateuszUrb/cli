/*
 *  vdom-server-render.js
 *
 *  Uses a domserver component like react-dom/server to render the HTML string
 *  for a given javascript virtualdom Enact codebase.
 */

const path = require('path'),
	nodeFetch = require('node-fetch'),
	vm = require('vm'),
	FileXHR = require('./FileXHR');

require('console.mute');

// Setup a generic shared context to run App code within
const m = {
	exports:{}
};
const sandbox = Object.assign({
	require: require,
	module: m,
	exports: m.exports,
	__dirname: process.cwd(),
	__filename: 'main.js',
	fetch: nodeFetch,
	Response: nodeFetch.Response,
	Headers: nodeFetch.Headers,
	Request: nodeFetch.Request
}, global);
const context = vm.createContext(sandbox);

/*
	Options:
		server			ReactDomServer or server with compatible APIs
		code			Javascript sourcecode string
		file 			Filename to designate the code from in NodeJS (visually noted within thrown errors)
		locale 			Specific locale to use in rendering
		externals		filepath to external Enact framework to use with rendering
*/
module.exports = {
	prepare: function(code, opts) {
		code = code.replace('return __webpack_require__(0);', '__webpack_require__.e = function() {};\nreturn __webpack_require__(0);');

		if(opts.externals) {
			// Add external Enact framework filepath if it's used.
			code = code.replace(/require\(["']enact_framework["']\)/g, 'require("'
					+ path.resolve(path.join(opts.externals, 'enact.js')) +  '")');
		}
		return code;
	},

	render: function(opts) {
		let rendered;

		if(opts.locale) {
			sandbox.XMLHttpRequest = FileXHR;
		} else {
			delete sandbox.XMLHttpRequest;
		}

		try {
			console.mute();

			if(opts.externals) {
				// Ensure locale switching  support is loaded globally with external framework usage.
				const framework = require(path.resolve(path.join(opts.externals, 'enact.js')));
				sandbox.iLibLocale = framework('@enact/i18n/locale');
			} else {
				delete sandbox.iLibLocale
			}

			m.exports = {};
			vm.runInContext(opts.code, context, {
				filename: opts.file,
				displayErrors: true
			});

			// Update locale if needed.
			if(opts.locale && sandbox.iLibLocale && sandbox.iLibLocale.updateLocale) {
				console.resume();
				sandbox.iLibLocale.updateLocale(opts.locale);
				console.mute();
			}

			rendered = opts.server.renderToString(m.exports['default'] || m.exports);

			console.resume();
		} catch(e) {
			console.resume();
			throw e;
		}
		return rendered;
	}
};