/**
 * Copyright (c) 2019 Shawwwn - All Rights Reserved
 * You may use, distribute and modify this code under the terms of the MIT 
 * license.
 *
 * @summary Browser Loading Vue's Single-File-Component(SFC)
 * @version 0.2
 * @author Shawwwn <shawwwn1@gmail.com>
 */

//
// module name - start
//
var Vueify = (function() {
//
// module name - end
//


//
// utils
//

/**
 * Polyfill import() for Firefox support
 * Modified from:
 * https://github.com/uupaa/dynamic-import-polyfill/blob/master/importModule.js
 * @param {string} url
 */
function importModule(url) {
	try {
		return (new Function(`return import('${url}')`))();
	} catch (err) {}

	return new Promise((resolve, reject) => {
		const vector = "$importModule$" + Math.random().toString(32).slice(2);
		const script = document.createElement("script");
		const destructor = () => {
			delete window[vector];
			script.onerror = null;
			script.onload = null;
			script.remove();
			URL.revokeObjectURL(script.src);
			script.src = "";
		};
		script.defer = "defer";
		script.type = "module";
		script.onerror = () => {
			reject(new Error(`Failed to import: ${url}`));
			destructor();
		};
		script.onload = () => {
			resolve(window[vector]);
			destructor();
		};
		const absURL = resolveUrl(url);
		const loader = `import * as m from "${absURL}"; window.${vector} = m;`; // export Module
		const blob = new Blob([loader], { type: "text/javascript" });
		script.src = URL.createObjectURL(blob);

		document.head.appendChild(script);
	});
}

/**
 * Load contents of a remote file
 * @param {string} url
 * @param {function(string)} callback
 */
function getContent(url, callback) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		if (xhr.status>=200 && xhr.status<300) {
			callback(xhr.responseText);
		} else {
			console.log(`Failed to load ${url}!`); // DEBUG
		}
	};
	xhr.open('GET', url, true);
	xhr.send();
}

/**
 * Resolve relative path into url
 * @param {string} url
 * @param {function(string)} callback
 */
function resolveUrl(path) {
	const a = document.createElement('a');
	a.href = path;
	return a.href;
}

/**
 * Attempt to get SFC's name from its url
 * By default, SFC's name should be file name of the .vue
 * @param {string} url
 */
function getSFCName(url) {
	if (!url) {
		return null;
	} else {
		url = String(url);
	}
	let loc = document.createElement('a');
	loc.href = url;
	let fn = loc.pathname.split('/').slice(-1)[0];
	if (fn) {
		let m = fn.match(/^([a-z][-_a-z0-9]*)(\.vue)?$/i);
		if (m) {
			return m[1].toLowerCase();
		}
	}
	delete loc;
	return null;
};

var scopeId_cache = {};

/**
 * Generate a random scope id
 * @return {string}
 */
function genScopeId() {
	const genId = () => {
		let p1 = ((new Date).getTime() % 65535).toString(16).padStart(4, '0');
		let p2 = Math.ceil(Math.random() * 65535).toString(16).padStart(4, '0');
		return `data-v-${p1}${p2}`;
	}

	let id = genId();
	while (scopeId_cache[id]) {
		id = genId();
	}

	scopeId_cache[id] = true;
	return id;
}

/**
 * Scan html and gather root Vue instances
 * Inspired from [vue-devtools](https://github.com/vuejs/vue-devtools)
 * @param {function (vue_instance)} callback
 * @return {[...vue_instance]}
 */
function scanRoot(callback) {
	let rootVueInstances = [];
	let inFragment = false;
	let currentFragment = null;

	walk(document, function(node) {
		// skip fragemented instances except the first
		if (inFragment) {
			if (node === currentFragment._fragmentEnd) {
				inFragment = false;
				currentFragment = null;
			}
			return true;
		}

		// collect root instance
		let instance = node.__vue__;
		if (instance) {

			// skip if root already recorded
			if (rootVueInstances.indexOf(instance.$root) === -1) {
				instance = instance.$root;
			} else {
				return true;
			}

			// process the first fragment
			if (instance._isFragment) {
				inFragment = true;
				currentFragment = instance;
			}

			rootVueInstances.push(instance);
			callback(instance);
			return true;
		}
	});

	return rootVueInstances;

	/**
	 * DOM walk helper
	 * @param {NodeList} nodes
	 * @param {Function} fn
	 */
	function walk(node, fn) {
		if (node.childNodes) {
			for (let i = 0, l = node.childNodes.length; i < l; i++) {
				const child = node.childNodes[i];
				const stop = fn(child);
				if (!stop) { walk(child, fn); }
			}
		}
	} /* end of walk() */
}

//
// member
//



/**
 * Finds all Vue SFCs in script tag of current document
 * @param {function(dom, url, name)} callback
 * @return Promise
 */
function findSFC(callback) {
	var promises = [];
	var components = document.querySelectorAll("script");
	if (components.length > 0) {
		components.forEach((dom, i) => {
			if (dom.type == 'vue') {
				let url = dom.src;
				let name = getSFCName(dom.getAttribute('name'));
				if (!name) {
					name = getSFCName(url);
					if (!name) {
						console.error('[VueifyJS]: Unable to parse SFC name from given dom.', dom);
						return;
					}
				}

				let ret = callback(dom, url, name);
				if (ret.__proto__ === Promise.prototype) {
					promises.push(ret);
				}
			}
		});
	}
	return Promise.all(promises);
}

/**
 * download .vue file from given url
 * Async version of getContent()
 * @return sfc_src
 */
function downloadSFC(sfc_url) {
	console.log(`download: ${sfc_url}`); // DEBUG
	return new Promise(resolve => {
		getContent(sfc_url, (sfc_src) => {
			resolve(sfc_src);
		});
	});
}

/**
 * Split SFC content by tags into 3 sections(CSS/JS/HTML).
 * @param {string} content
 * @return {css {dom, txt, src}, js {dom, txt, src}, html {dom, txt, src}}
 */
async function parseSFC(sfc_src) {
	var doc = new DOMParser().parseFromString(sfc_src, 'text/html');
	var ret = {
		css: assemble(doc.querySelectorAll("style")),
		js: assemble(doc.querySelectorAll("script")),
		html: assemble(doc.querySelectorAll("template")),
	};
	return ret;

	// extra src text from each tag
	function assemble(doms) {
		return Array.from(doms).map((dom, j) => {
			return {
				dom: dom,
				txt: dom.innerHTML,
				src: dom.outerHTML
			};
		});
	}
}

/**
 * Generate & apply @.scopeId for all 'scoped' style tags.
 * Combine all style tags into @.cssText
 * @param {js, css{ dom, src, txt }, html} sfc_obj
 * @return input CSS object
 */
async function preprocessCSS(sfc_obj) {
	var css = sfc_obj.css;

	var _scopeId = null;
	var _cssText = "";
	var tmp_iframe = null; // to temporarily hold and parse css text

	await Promise.all(css.map(async (el, i) => {

		// scoped style
		if (el.dom.hasAttribute('scoped')) {
			// generate scopeId
			if (!_scopeId) {
				_scopeId = genScopeId();
				console.log("scopeId:", _scopeId); // DEBUG
			}

			// create temporary iframe to hold & parse css text
			if (!tmp_iframe) {
				tmp_iframe = document.createElement('iframe');
				tmp_iframe.style.cssText="display: none;"
				document.body.appendChild(tmp_iframe);
			}

			// download external css to process
			let external_txt = "";
			external_txt = await new Promise((resolve, reject) => {
				if (el.dom.hasAttribute('src')) {
					let path = el.dom.getAttribute('src');
					getContent(resolveUrl(path), (content) => resolve(content));
				} else {
					resolve('');
				}
			});

			// use browser to parse css text
			let s = tmp_iframe.contentDocument.createElement('style');
			s.innerHTML = el.txt + external_txt;
			tmp_iframe.contentDocument.head.appendChild(s);
			let rules = s.sheet.cssRules;
			for (let i=0; i<rules.length; i++) {

				// add scopeId to each css
				if (_scopeId) {
					rules[i].selectorText += `[${_scopeId}]`;
				}

				_cssText += rules[i].cssText + '\n';
			}
			s.remove();
		} else {
			_cssText += el.txt + '\n';
		}

	}));

	if (tmp_iframe) { tmp_iframe.remove(); }
	css.scopeId = _scopeId;
	css.cssText = _cssText;
	return css;
}

/**
 * Combine all template tags into @.templateText
 * @param {js, css, html{ dom, src, txt }} sfc_obj
 * @return input HTML object
 */
async function preprocessHTML(sfc_obj) {
	var html = sfc_obj.html;

	var _templateText = html.reduce((accu, cv) => {
		return accu + cv.txt;
	}, '');  // combine all templates

	html.templateText = _templateText.trim();
	return html;
}

var cachedSFCs = {}; // { url : {blob_url, sfc_obj} }

/**
 * Combine all script tags into @.jsText
 * @param {js{ dom, src, txt }, css, html} sfc_obj
 * @param [sfc_name] deps, dependency stack
 * @return input JS object
 */
async function preprocessJS(sfc_obj, deps=[]) {
	console.log('dependency stack', deps); // DEBUG
	var js = sfc_obj.js;

	// get content only from last script tag
	var el = js[js.length-1];
	var _jsText = await new Promise((resolve, reject) => {
		if (el.dom.hasAttribute('src')) {
			let path = el.dom.getAttribute('src');
			getContent(resolveUrl(path), (content) => resolve(content));
		} else {
			resolve('');
		}
	});
	_jsText += '\n' + el.txt;

	// TODO: interact other preprocessors(e.g., babel, if any).

	// search for 'import *.vue' statements and transpile the .vue file
	const re = /import .+ from ['"`](.*\.vue)["'`]/g
	_jsText = await asyncStringReplace(_jsText, re, async(match, path, offset, txt) => {

		let child_sfc_url = resolveUrl(path);
		console.log(`found child: ${child_sfc_url}`); // DEBUG

		// check cyclic dependency
		if (deps.indexOf(child_sfc_url) != -1) {
			let msg = [...deps, child_sfc_url].join(' ==> ');
			console.error(`[VueifyJS]: Cyclic dependency detected.\n${msg}`);
			throw '';
		}

		// if no cached sfc obj to be used directly, load sfc from remote
		if (!cachedSFCs.hasOwnProperty(child_sfc_url)) {
			let resolve;
			cachedSFCs[child_sfc_url] = new Promise((res) => { resolve = res });

			// extend dep stack with current sfc name
			let ds = deps.slice();
			ds.push(child_sfc_url);

			// load sfc
			let child_sfc_src = await downloadSFC(child_sfc_url);
			let [child_sfc_code, child_sfc_obj] = await transpileSFC(child_sfc_src, ds);
			child_sfc_obj.url = child_sfc_url;
			let [child_sfc_blob_url, child_sfc_blob] = await uploadSFC(child_sfc_code);
			child_sfc_obj.sfc_blob = child_sfc_blob;
			child_sfc_obj.sfc_blob_url = child_sfc_blob_url;
			cachedSFCs[child_sfc_url] = {
				blob_url: child_sfc_blob_url,
				sfc_obj: child_sfc_obj,
			};

			resolve(cachedSFCs[child_sfc_url]);
		} else {
			console.log(`cached: ${child_sfc_url}`); // DEBUG
		}

		// replace import statement from relative path to blob url
		let cache = await Promise.resolve(cachedSFCs[child_sfc_url]);
		new_str = match.replace(path, cache.blob_url);
		console.log(`${match} ====> ${new_str}`); // DEBUG
		return new_str;
	});

	js.jsText = _jsText;
	return js;

	/**
	 * Async version of `string.prototype.replace`
	 * Modified from Jason Yu: 
	 * https://gist.github.com/ycmjason/370f9a476648b0a8ce6130e1cb0c2893
	 */
	async function asyncStringReplace(str, regex, aReplacer) {
		regex = new RegExp(regex, regex.flags + (regex.flags.includes('g') ? '': 'g'));
		let sections = [];
		let match;
		let i = 0;
		while ((match = regex.exec(str)) !== null) {
			sections.push(str.slice(i, match.index));
			sections.push(aReplacer(...match, match.index, match.input));
			i = regex.lastIndex;
		}
		sections.push(str.slice(i));

		return (await Promise.all(sections)).join('');
	};
}

/**
 * Turn js module code into a blob and return the blob's url
 * @return [string, blob]
 */
async function uploadSFC(sfc_code) {
	blob = new Blob([sfc_code], {type : 'text/javascript'});
	blob_url = URL.createObjectURL(blob);
	return [blob_url, blob];
}

/**
 * Turn SFC source code into js module code
 * @param {string} sfc_src
 * @param [sfc_name] deps, is the dependency stack
 * @return {string, object}
 */
async function transpileSFC(sfc_src, deps=[]) {
	console.log('transpile:', deps[deps.length-1]); // DEBUG
	let sfc_obj = await parseSFC(sfc_src);
	await preprocessCSS(sfc_obj);
	await preprocessHTML(sfc_obj);
	await preprocessJS(sfc_obj, deps);

	// add .template to module export
	let sfc_code = sfc_obj.js.jsText;
	sfc_code = sfc_code.replace(/export\W+default/i, `let opts=`);

	sfc_code += `opts.template = \`${sfc_obj.html.templateText}\`;\n`;

	if (sfc_obj.css.scopeId) {
		sfc_code += `opts._scopeId = \`${sfc_obj.css.scopeId}\`;\n`;
	}

	if (sfc_obj.css.cssText.trim() !== '') {
		sfc_code += [
			// create css dom
			`let dom = document.createElement('style');`,
			`dom.innerHTML = \`${sfc_obj.css.cssText}\`;`,
			`dom.setAttribute('vue-sfc', '');`,

			// inject css dom at beforeCreate()
			`let _beforeCreate = opts.beforeCreate;`,
			`opts.beforeCreate = function() {`,
			`	document.head.appendChild(dom);`,
			`	this.$cssDom = dom;`,
			`	if (_beforeCreate) { _beforeCreate(); }`,
			`}`,

			// remove css dom when destroyed()
			`let _destroyed = opts.destroyed;`,
			`opts.destroyed = function() {`,
			`	this.$cssDom = dom;`,
			`	if (this.$cssDom) {`,
			`		this.$cssDom.remove();`,
			`		delete this.$cssDom;`,
			`	}`,
			`	if (_destroyed) { _destroyed(); }`,
			`};`,
		].join('\n');
	}

	sfc_code += `export default opts;\n`;

	return [sfc_code, sfc_obj];
}


/**
 * Dynamically import remote SFC
 * `importSFC('hello', './Hello.vue')`
 * is equivalent to
 * `import hello from './Hello.vue'`
 * @param {String} url, ending in .vue
 */
async function importSFC(url) {
	let sfc_url = resolveUrl(url);

	// check cache
	if (cachedSFCs.hasOwnProperty(sfc_url)) {
		console.log(`cached: ${sfc_url}`); // DEBUG
	} else {
		// transpile
		let resolve;
		cachedSFCs[sfc_url] = new Promise((res) => { resolve = res });
		let sfc_src = await downloadSFC(sfc_url);
		let [sfc_code, sfc_obj] = await transpileSFC(sfc_src, [sfc_url]);
		sfc_obj.url = sfc_url;
		let [sfc_blob_url, sfc_blob] = await uploadSFC(sfc_code);
		sfc_obj.sfc_blob = sfc_blob;
		sfc_obj.sfc_blob_url = sfc_blob_url;

		// import
		var sfc_module = await importModule(sfc_blob_url);

		cachedSFCs[sfc_url] = {
			blob_url: sfc_blob_url,
			sfc_obj: sfc_obj,
			module: sfc_module,
		};
		resolve(cachedSFCs[sfc_url]);
	}

	return Promise.resolve(cachedSFCs[sfc_url].module.default);
}


var pendingSFCs = {}; // record unfinished downloads
var rootSFCs = [];
var muteNames = []; // mute if these names ever appear in Vue's warnings


/**
 * Find & transpile all .vue files from script tags,
 * then register them as global Vue components.
 * 
 * Must be called right after Vue.js is loaded, because Vue stops registering
 * components if left running for a short while. (reason is unknown)
 */
async function registerRootSFCs() {

	// Scan script tags to find SFCs
	await findSFC((sfc_dom, sfc_url, sfc_name) => {

		muteNames.push(sfc_name); // mute Vue warning

		return async function() {
			sfc_url = resolveUrl(sfc_url);
			console.log(`register: ${sfc_url}`); // DEBUG

			// check cache
			if (cachedSFCs.hasOwnProperty(sfc_url)) {
				console.log(`cached: ${sfc_url}`); // DEBUG
				sfc_dom.remove();
				return;
			}

			// transpile
			let resolve;
			cachedSFCs[sfc_url] = new Promise((res) => { resolve = res });
			let sfc_src = await downloadSFC(sfc_url);
			let [sfc_code, sfc_obj] = await transpileSFC(sfc_src, [sfc_url]);
			sfc_obj.url = sfc_url;
			sfc_obj.name = sfc_name;
			let [sfc_blob_url, sfc_blob] = await uploadSFC(sfc_code);
			sfc_obj.sfc_blob = sfc_blob;
			sfc_obj.sfc_blob_url = sfc_blob_url;
			cachedSFCs[sfc_url] = {
				blob_url: sfc_blob_url,
				sfc_obj: sfc_obj,
			};
			resolve(cachedSFCs[sfc_url]);
			rootSFCs.push(sfc_obj);

			// finish registering async component
			var module = await importModule(sfc_blob_url);
			Vue.component(sfc_name, module.default);

			// workaround for https://github.com/vuejs/vue-devtools/issues/969
			let global_components = Object.getPrototypeOf(Vue.options.components);
			if (global_components != null) {
				global_components[sfc_name] = Vue.options.components[sfc_name];
				delete Vue.options.components[sfc_name];
			}

			sfc_dom.remove();
		}();

	}); // end of findSFC callback

	// update all Vue instances
	scanRoot((vue) => vue.$forceUpdate());
}

/**
 * Hook Vue's warnhandler
 * Mute 'Unknown Element' warnings of our SFCs
 */
function muteVueWarnings() {
	const _warnHandler = Vue.config.warnHandler;
	const hasConsole = typeof console !== 'undefined';
	Vue.config.warnHandler = function(msg, vm, trace) {
		let mute = false;
		if (msg.indexOf('Unknown custom element:') == 0) {
			for (var i=0; i<muteNames.length; i++) {
				if (msg.indexOf(`<${muteNames[i]}>`) == 24) {
					mute = true;
					break;
				}
			}
		}

		if (!mute) {
			if (_warnHandler) {
				Vue.config.warnHandler.call(null, msg, vm, trace);
			} else if (hasConsole && (!Vue.config.silent)) {
				console.error(("[Vue warn]: " + msg + trace));
			}
		}
	}
}

/**
 * Module Initialization
 */
function init() {
	if (!Vue) {
		console.error('[Vueify]: Need Vue to run.');
		return;
	}

	muteVueWarnings();
	registerRootSFCs();
}

//
// main
//
init();

//
// module export - start
//
return {
	// optional exports
	importModule,
	findSFC,
	downloadSFC,
	parseSFC,
	preprocessCSS,
	preprocessHTML,
	preprocessJS,
	uploadSFC,
	init,

	// core exports
	importSFC,
	transpileSFC,
	registerRootSFCs,
	rootSFCs,
	cachedSFCs,
	muteNames,
};
}());
//
// module export - end
//


