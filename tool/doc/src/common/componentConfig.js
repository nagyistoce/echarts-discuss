/**
 * @file component默认配置
 * @author sushuang(sushuang@baidu.com)
 * @date 2014-04
 */

define(function (require) {

    var Component = require('dt/ui/Component');

    // 可在tpl中使用的types。
    // 放在这里声明是为了模块加载。
    var cptClasses = Component.cptClasses;

    // common component
    cptClasses['TreeList'] = require('dt/ui/TreeList');
    cptClasses['TextInput'] = require('dt/ui/TextInput');
    cptClasses['CheckButton'] = require('dt/ui/CheckButton');
    // ... other components
});