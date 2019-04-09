/**
 * Copyright (c) 2019 Shawwwn - All Rights Reserved
 * You may use, distribute and modify this code under the terms of the MIT 
 * license.
 *
 * @summary Browser Loading Vue's Single-File-Component(SFC)
 * @version 0.2
 * @author Shawwwn <shawwwn1@gmail.com>
 */

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
			console.log(`Failed to load ${url}!`);
		}
	};
	xhr.open('GET', url, true);
	xhr.send();
}

//
// utils
//

/**
 * Resolve relative path into url
 * @param {string} url
 * @param {function(string)} callback
 */
function resolveUrl(path) {
	var url = path;
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

/**
 * Generate a random scope id
 * TODO: Not doing accounting atm.
 *       Just hopping numbers are large enough thus won't collide. ;)
 * @return {string}
 */
function genScopeId() {
	var p1 = ((new Date).getTime() % 65535).toString(16).padStart(4, '0');
	var p2 = Math.ceil(Math.random() * 65535).toString(16).padStart(4, '0');
	return `data-v-${p1}${p2}`;
}

/**
 * Scan html and gather root Vue instances
 * Inspired from [vue-devtools](https://github.com/vuejs/vue-devtools)
 * @param {function (vue_instance)} callback
 * @return {[...vue_instance]}
 */
function scanRoot(callback) {
	rootInstances = [];
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
			if (rootInstances.indexOf(instance.$root) === -1) {
				instance = instance.$root;
			} else {
				return true;
			}

			// process the first fragment
			if (instance._isFragment) {
				inFragment = true;
				currentFragment = instance;
			}

			rootInstances.push(instance);
			callback(instance);
			return true;
		}
	});

	return rootInstances;

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
 * Finds all Vue's SFCs in html
 * @param {function(dom, url, name)} callback
 */
var mute_names = []; // mute if these names ever appear in Vue's warnings
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
						console.error('Unable to parse SFC name for', dom);
						return;
					}
				}
				mute_names.push(name);
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
	console.log(`download: ${sfc_url}`);
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
		html: assemble(doc.querySelectorAll("template"))
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
 * @param { dom, src, txt } css
 * @return input CSS object
 */
async function preprocessCSS(css) {
	var _scopeId = null;
	var _cssText = "";
	var tmp_iframe = null; // to temporarily hold and parse css text

	// TODO: Allow mixing scoped/non-scoped styles
	// TODO: Below only works for newest chrome.
	//       Use <style> injection for cross-browser compatibility
	css.forEach((el, i) => {

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

			let s = tmp_iframe.contentDocument.createElement('style');
			s.innerHTML = el.txt;
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

		// import external file via 'src' attribute
		if (el.dom.hasAttribute('src')) {
			var l = document.createElement('link');
			l.href = el.dom.getAttribute('src');
			l.type = "text/css";
			l.rel = "stylesheet";
			document.head.appendChild(l);
			// TODO: ajax load and add scope to css file
		}
	});

	// inject cssText
	var _cssDom = document.createElement('style');
	_cssDom.innerHTML = _cssText;
	document.body.appendChild(_cssDom);

	tmp_iframe.remove()
	css.cssDom = _cssDom;
	css.scopeId = _scopeId;
	css.cssText = _cssText;
	return css;
}

/**
 * Combine all template tags into @.templateText
 * @param { dom, src, txt } html
 * @return input HTML object
 */
async function preprocessHTML(html) {
	var _templateText = html.reduce((accu, cv) => {
		return accu + cv.txt;
	}, '');  // combine all templates
	// TODO: import external template file via 'src' attribute

	html.templateText = _templateText.trim();
	return html;
}

/**
 * Combine all script tags into @.jsText
 * @param { dom, src, txt } js
 * @return input JS object
 */
async function preprocessJS(js) {
	var _jsText = js.reduce((accu, cv) => {
		return accu + cv.txt;
	}, '');
	// TODO: import external js file via 'src' attribute

	const re = /import .+ from ['"`](.*\.vue)["'`]/g

	// first generate a dict for url transforms
	let matches = Array.from(_jsText.matchAll(re))
	let url_dict = {}; // {path: blob-url}
	await Promise.all(matches.map(async ([txt, path], i) => {
		let child_sfc_url = resolveUrl(path);
		console.log(`found child: ${child_sfc_url}`);
		// TODO: check cache for blob url
		let child_sfc_src = await downloadSFC(child_sfc_url);
		let [child_sfc_code, child_sfc_obj] = await transpileSFC(child_sfc_src);
		let [child_sfc_blob_url, child_sfc_blob] = await uploadSFC(child_sfc_code);
		url_dict[path] = child_sfc_blob_url;

		if (!js.children) { js.children = []; } // DEBUG
		child_sfc_obj.sfc_blob = child_sfc_blob; // DEBUG
		child_sfc_obj.sfc_blob_url = child_sfc_blob_url; // DEBUG
		js.children.push(child_sfc_obj); // DEBUG: record assembled child SFC object
	}));

	// replace source code using the dict
	_jsText = _jsText.replace(re, (txt, path, pos) => {
		new_txt = txt.replace(path, url_dict[path])
		console.log(`${txt} ====> ${new_txt}`) // DEBUG
		return new_txt;
	});

	js.jsText = _jsText;
	return js;
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
 * @return {string, object}
 */
async function transpileSFC(sfc_src) {
	console.log('transpile:', sfc_src);
	let sfc_obj = await parseSFC(sfc_src);
	await preprocessCSS(sfc_obj.css);
	await preprocessHTML(sfc_obj.html);
	await preprocessJS(sfc_obj.js);

	// add .template to module export
	let sfc_code = sfc_obj.js.jsText;
	let sfc_var = `sfc_${genScopeId().substr(7)}`;
	sfc_code = sfc_code.replace(/export\W+default/i, `let ${sfc_var}=`);
	sfc_code += `${sfc_var}.template = \`${sfc_obj.html.templateText}\`;\n`;
	sfc_code += `${sfc_var}._scopeId = \`${sfc_obj.css.scopeId}\`;\n`;
	sfc_code += `export default ${sfc_var};\n`;

	return [sfc_code, sfc_obj];
}

/**
 * Init 
 */
var SFC = []; // DEBUG
function init() {

	/* Hook Vue's warnhandler */
	const _warnHandler = Vue.config.warnHandler;
	const hasConsole = typeof console !== 'undefined';
	Vue.config.warnHandler = function(msg, vm, trace) {
		let mute = false;
		if (msg.indexOf('Unknown custom element:') == 0) {
			for (var i=0; i<mute_names.length; i++) {
				if (msg.indexOf(`<${mute_names[i]}>`) == 24) {
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

	/* Scan script tag for Vue's SFC */
	findSFC(async (sfc_dom, sfc_url, sfc_name) => {
		var sfc_src = await downloadSFC(sfc_url);
		var [sfc_code, sfc_obj] = await transpileSFC(sfc_src);
		var [sfc_blob_url, sfc_blob] = await uploadSFC(sfc_code);

		// assemble and apply self-executable js for root-level SFC
		js_src = `
			import ${sfc_name} from "${sfc_blob_url}";
			Vue.component('${sfc_name}', ${sfc_name});
			scanRoot((vue) => vue.$forceUpdate());
		`;
		var script = document.createElement('script');
		script.type = 'module';
		script.innerHTML = js_src;
		document.body.appendChild(script);

		sfc_dom.remove();

		sfc_obj.sfc_blob = sfc_blob; // DEBUG
		sfc_obj.sfc_blob_url = sfc_blob_url; // DEBUG
		SFC.push(sfc_obj); // DEBUG
	});
}


//
// main
//
init();
