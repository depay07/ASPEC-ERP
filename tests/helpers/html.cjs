const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '../../js/utils.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.match(/function escapeHtml\(value\) \{[\s\S]*?\n\}/)[0], context);
module.exports = {escapeHtml: context.escapeHtml, escapeAttr: context.escapeHtml};
