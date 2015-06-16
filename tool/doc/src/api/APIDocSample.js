/**
 * api doc sample
 */
define(function (require) {

    var $ = require('jquery');
    var Component = require('dt/ui/Component');
    var schemaHelper = require('../common/schemaHelper');
    var dtUtil = require('dt/util');

    require('../common/ui/componentConfig');

    var SCHEMA_URL = '../migrate/optionSchema.json';
    var TPL_TARGET = 'APIDocSample';
    var SELECTOR_DESC_CN = '.ecdoc-api-desc-cn';
    var SELECTOR_DESC_EN = '.ecdoc-api-desc-en';

    /**
     * 编辑端入口
     *
     * @class
     * @extends dt/ui/Component
     */
    var APIDocSample = Component.extend({

        _define: {
            tpl: require('tpl!./doc.tpl.html'),
            css: 'ecdoc-apidoc',
            viewModel: function () {
                return {
                    apiTreeDatasource: null,
                    apiTreeSelected: dtUtil.ob()
                };
            }
        },

        _prepare: function () {
            this._viewModel().apiTreeDatasource = [];

            // this._makeTestData();
            $.getJSON(SCHEMA_URL, $.proxy(this._handleSchemaLoaded, this));
        },

        _handleSchemaLoaded: function (schema) {
            var renderBase = {};
            schemaHelper.buildDoc(schema, renderBase);

            var root = renderBase.children[0];
            root = {
                value: 'root',
                text: 'option = ',
                childrenPre: '{',
                childrenPost: '}',
                childrenBrief: ' ... ',
                children: root.children,
                expanded: true
            };

            var viewModel = this._viewModel();
            viewModel.apiTreeDatasource = [root];
            this._applyTpl(this.$el(), TPL_TARGET);

            this._disposable(
                this._sub('apiDocTree')._viewModel().hovered.subscribe(this._updateDesc, this)
            );
        },

        _makeTestData: function() {
            var apiTreeDatasource = this._viewModel().apiTreeDatasource = [];

            // For test
            apiTreeDatasource.push({
                value: 'root',
                text: 'option = ',
                tooltip: 'option root',
                childrenPre: '{',
                childrenPost: '}',
                children: [
                    makeItem([makeItem(), makeItem(), makeItem()]),
                    makeItem(),
                    makeItem([makeItem(), makeItem()])
                ]
            });

            function makeItem(children) {
                return {
                    value: 'option = ',
                    text: 'asdf' + Math.random(),
                    childrenPre: ': {',
                    childrenPost: '}',
                    childrenBrief: ' ... ',
                    children: children
                };
            }
        },

        _updateDesc: function (treeItem) {
            if (treeItem) {
                var $el = this.$el();
                $el.find(SELECTOR_DESC_CN)[0].innerHTML = treeItem.descriptionCN || '无说明';
                $el.find(SELECTOR_DESC_EN)[0].innerHTML = treeItem.descriptionEN || 'No description';
            }
        }
    });


    return APIDocSample;
});
