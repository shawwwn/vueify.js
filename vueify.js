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
	let a = document.createElement('a');
	a.href = path;
	let url = a.href;
	delete a;
	return url;
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

var muteNames = []; // mute if these names ever appear in Vue's warnings

/**
 * Finds all Vue SFCs in script tag of current document
 * @param {function(dom, url, name)} callback
 */
function findSFC(callback) {
	var components = document.querySelectorAll("script");
	if (components.length > 0) {
		components.forEach((dom, i) => {
			if (dom.type == 'vue') {
				let url = dom.src;
				let name = getSFCName(dom.getAttribute('name'));
				if (!name) {
					name = getSFCName(url);
					if (!name) {
						console.error('[Vueify]: Unable to parse SFC name from given dom.', dom);
						return;
					}
				}
				muteNames.push(name);
				callback(dom, url, name);
			}
		});
	}
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
			let rules = s.sheet.rules;
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

	// get content from last script tag
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

	// search for 'import *.vue' statements and transpile the .vue file
	const re = /import .+ from ['"`](.*\.vue)["'`]/g
	let matches = Array.from(_jsText.matchAll(re))
	await Promise.all(matches.map(async ([txt, path], i) => {
		let child_sfc_url = resolveUrl(path);
		console.log(`found child: ${child_sfc_url}`); // DEBUG

		// check cyclic dependency
		if (deps.indexOf(child_sfc_url) != -1) {
			let msg = [...deps, child_sfc_url].join(' ==> ');
			console.error(`[VueifyJS]: Cyclic dependency detected.\n${msg}`);
			throw '';
		}

		// check if there is cached sfc obj to be used directly
		if (!cachedSFCs.hasOwnProperty(child_sfc_url)) {
			let resolve;
			cachedSFCs[child_sfc_url] = new Promise((res) => { resolve = res });

			// extend dep stack with current sfc name
			let ds = deps.slice();
			ds.push(child_sfc_url);

			// if no cached, load sfc
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
		return true;
	})).catch(error => {
		throw error;
	});


	// replace .vue path with blob url
	_jsText = await replace_async(_jsText, re, async (txt, path, pos) => {
		let url = resolveUrl(path);
		let cache = await Promise.resolve(cachedSFCs[url]);
		new_txt = txt.replace(path, cache.blob_url);
		console.log(`${txt} ====> ${new_txt}`); // DEBUG
		return new_txt;
	});

	js.jsText = _jsText;
	return js;

	// Async string replace
	// TODO: rewrite for a more efficient version
	async function replace_async(str, re, cb_async) {
		let ps = [];
		str.replace(re, (match, ...args) => {
			let p = cb_async(match, ...args);
			ps.push(p);
		});
		let data = await Promise.all(ps);
		return str.replace(re, () => data.shift());
	}
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
			// inject css tag
			`let dom = document.createElement('style');`,
			`dom.innerHTML = \`${sfc_obj.css.cssText}\`;`,
			`document.body.appendChild(dom);`,

			// bind css dom to Vue instance
			`let _beforeCreate = opts.beforeCreate;`,
			`opts.beforeCreate = function() {`,
			`	this.$cssDom = dom;`,
			`	if (_beforeCreate) { _beforeCreate(); }`,
			`}`,

			// remove css dom when Vue instance is destroyed
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

var pendingSFCs = {}; // record unfinished downloads
var rootSFCs = [];

/**
 * Find & transpile all .vue files from script tags,
 * then register them as global Vue components.
 * 
 * Must be called right after Vue.js is loaded, because Vue stops registering
 * components if left running for a short while. (reason is unknown)
 */
function registerRootSFCs() {

	/* Scan script tag for Vue's SFC */
	findSFC(async (sfc_dom, sfc_url, sfc_name) => {

		// TODO: Vue.component() registeration no longer has effect when Vue 
		//       finishs scanning the entire document(warnings are thrown for 
		//       unknown elements). Thus, global components will not load 
		//       sometimes.
		//       Current solution is to use promise to hold the place for named
		//       components until this module later return with data.
		//       A more robust way of guaranteed loading components is to hook 
		//       Vue's constructor, init vue instance only after finishing 
		//       component registerations.

		sfc_url = resolveUrl(sfc_url);
		console.log(`found: ${sfc_url}`); // DEBUG

		// check cache
		if (cachedSFCs.hasOwnProperty(sfc_url)) {
			console.log(`cached: ${sfc_url}`); // DEBUG
			sfc_dom.remove();
			return;
		}

		// register async component immediately
		if (!pendingSFCs[sfc_name]) {
			Vue.component(sfc_name, (resolve, reject) => {
				const wrapper = (func) => {
					return (data) => {
						func(data);
						scanRoot((vue) => vue.$forceUpdate());
					};
				};
				pendingSFCs[sfc_name] = {
					resolve: wrapper(resolve),
					reject: wrapper(reject)
				};
			});
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
		var module = await import(sfc_blob_url);
		if (pendingSFCs.hasOwnProperty(sfc_name)) {
			pendingSFCs[sfc_name].resolve(module.default);
			delete pendingSFCs[sfc_name];
		} else {
			console.error('[VueifyJS]: Unable to register components in Vue.' + 
				'\nPlease make sure that Vueify is loaded before creating ' +
				'the first Vue instance.' , sfc_obj);
		}

		sfc_dom.remove();
	});
}

/**
 * Module Initialization
 */
function init() {

	if (!Vue) {
		console.error('[Vueify]: Need Vue to run.');
		return;
	}

	/* Hook Vue's warnhandler */
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
	findSFC,
	downloadSFC,
	parseSFC,
	preprocessCSS,
	preprocessHTML,
	preprocessJS,
	uploadSFC,
	init,

	// core exports
	registerRootSFCs,
	transpileSFC,
	rootSFCs,
	cachedSFCs,
	muteNames,
};
}());
//
// module export - end
//


