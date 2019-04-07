/**
 * Copyright (c) 2019 Shawwwn - All Rights Reserved
 * You may use, distribute and modify this code under the terms of the MIT 
 * license.
 *
 * @summary Browser Loading Vue's Single-File-Component(SFC)
 * @version 0.1
 * @author Shawwwn <shawwwn1@gmail.com>
 */


/**
 * Parse SFC's name from its url
 * @param {string} url
 */
function parseSFCName(url) {
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
 * Finds all Vue's SFCs in html
 * @param {function(dom, url, name)} callback
 */
function findSFC(callback) {
	var components = document.querySelectorAll("script");
	if (components.length > 0) {
		components.forEach((dom, i) => {
			if (dom.type == 'vue') {
				let url = dom.src;
				let name = parseSFCName(dom.getAttribute('name'));
				if (!name) {
					name = parseSFCName(url);
					if (!name) {
						console.error('Unable to parse SFC name for', dom);
						return;
					}
				}
				callback(dom, url, name);
			}
		});
	}
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
			console.log(`Failed to load ${url}!`);
		}
	};
	xhr.open('GET', url, true);
	xhr.send();
}

/**
 * Parse SFC file into individual(CSS/JS/HTML) tags
 * @param {string} content
 * @return {css, js, html}
 */
function parseSFC(content) {
	var doc = new DOMParser().parseFromString(content, 'text/html');
	var ret = {
		css: parse(doc.querySelectorAll("style")),
		js: parse(doc.querySelectorAll("script")),
		html: parse(doc.querySelectorAll("template"))
	};
	return ret;

	// extra src text from each tag
	function parse(doms) {
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
// main
//
var SFC = []; // TODO: for debug only
findSFC((sfc_dom, sfc_url, sfc_name) => {
	getContent(sfc_url, (content) => {
		console.log(sfc_url+'\n', content);
		var parsed = parseSFC(content);
		SFC.push(Object.assign(parsed, {
			url: sfc_url,
			name: sfc_name,
			dom: sfc_dom,
			txt: content,
		})); // TODO: for debug only
		var scoped = parsed.css.reduce((accu, cv) => {
			return accu || cv.dom.hasAttribute('scoped');
		}, false);
		console.log("scoped:", scoped);

		// generate scopeId
		var scopeId = '';
		if (scoped) {
			scopeId = genScopeId();
			console.log("scopeId:", scopeId);
		}

		/*
		 * Process CSS
		 */
		// TODO: Allow mixing scoped/non-scoped styles
		// TODO: Below only works for newest chrome.
		//       Use <style> injection for cross-browser compatibility
		parsed.css.forEach((el, i) => {
			let src = el.txt;
			let sheet = new CSSStyleSheet(); // TODO: only works in chrome
			sheet.replaceSync(src); // TODO: only works in chrome

			if (scoped) {
				// add scopeId to each css
				keys = Object.keys(sheet.rules);
				keys.forEach((key, j) => {
					sheet.rules[key].selectorText += `[${scopeId}]`;
				});
			}

			document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; // TODO: only works in chrome
			console.log("style appended:", sheet);

			// import external file via 'src' attribute
			if (el.dom.hasAttribute('src')) {
				var l = document.createElement("link");
				l.href = el.dom.getAttribute('src');
				l.type = "text/css";
				l.rel = "stylesheet";
				document.head.appendChild(l);
				// TODO: ajax load and add scope to css file
			}
		});


		/*
		 * Process HTML
		 */
		var template = parsed.html.reduce((accu, cv) => {
			return accu + cv.txt;
		}, ''); // combine all templates
		// TODO: import external template file via 'src' attribute


		/*
		 * Process JavaScript
		 */
		var js_src = parsed.js.reduce((accu, cv) => {
			return accu + cv.txt;
		}, '');
		// TODO: recursively process vue import statement in script tag
		// TODO: custom component name
		var sfc_var = `sfc_${genScopeId().substr(7)}`;

		// globally register vue component
		// TODO: Apply closure to self-executing code
		js_src = js_src.replace(/export\W+default/gi, `var ${sfc_var}=`);
		js_src += `${sfc_var}.template = \`${template}\`;`;
		js_src += `Vue.component('${sfc_name}', ${sfc_var});`;
		js_src += `scanRoot((vue) => vue.$forceUpdate());`; // re-render root

		var script = document.createElement('script');
		script.type = 'module';
		script.innerHTML = js_src;
		document.body.appendChild(script);
		// TODO: import external template file via 'src' attribute


		/*
		 * Finally
		 */
		sfc_dom.remove();
	});
});

