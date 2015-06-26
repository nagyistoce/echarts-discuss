/**
 * @file component默认配置
 * @author sushuang(sushuang@baidu.com)
 */

define(function (require) {

    var Component = require('./ui/Component');

    // 可在tpl中使用的types。
    // 放在这里声明是为了模块加载。
    var cptClasses = Component.cptClasses;

    // common component
    cptClasses['TreeList'] = require('./ui/TreeList');
    cptClasses['TextInput'] = require('./ui/TextInput');
    cptClasses['CheckButton'] = require('./ui/CheckButton');
    cptClasses['WinPanel'] = require('./ui/WinPanel');
    cptClasses['Button'] = require('./ui/Button');
    // ... other components
});
