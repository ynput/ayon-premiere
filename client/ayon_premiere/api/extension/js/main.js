/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true,
indent: 4, maxerr: 50 */
/*global $, window, location, CSInterface, SystemPath, themeManager*/


var csInterface = new CSInterface();

log.warn("script start");

WSRPC.DEBUG = false;
WSRPC.TRACE = false;

// get websocket server url from environment value
async function startUp(url){
    log.warn(url);
    promis = runEvalScript("getEnv('" + url + "')");

    var res = await promis;
    log.warn("res: " + res);

    promis = runEvalScript("getEnv('AYON_DEBUG')");
    var debug = await promis;
    log.warn("debug: " + debug);
    if (debug && debug.toString() == '3'){
        WSRPC.DEBUG = true;
        WSRPC.TRACE = true;
    }
    // run rest only after resolved promise
    main(res);
}

function get_extension_version(){
    /** Returns version number from extension manifest.xml **/
    log.debug("get_extension_version")
    var path = csInterface.getSystemPath(SystemPath.EXTENSION);
    log.debug("extension path " + path);

    var result = window.cep.fs.readFile(path + "/CSXS/manifest.xml");
    var version = undefined;
    if(result.err === 0){
        if (window.DOMParser) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(result.data.toString(),
                                                  'text/xml');
            const children = xmlDoc.children;

            for (let i = 0; i <= children.length; i++) {
                if (children[i] &&
                children[i].getAttribute('ExtensionBundleVersion')) {
                    version =
                        children[i].getAttribute('ExtensionBundleVersion');
                }
            }
        }
    }
    return '{"result":"' + version + '"}'
}

function main(websocket_url){
    // creates connection to 'websocket_url', registers routes
    var default_url = 'ws://localhost:8096/ws/';

    if  (websocket_url == ''){
         websocket_url = default_url;
    }
    RPC = new WSRPC(websocket_url, 5000); // spin connection

    RPC.connect();

    log.warn("connected");

    RPC.addRoute('Premiere.open', function (data) {
        log.warn('Server called client route "open":', data);
        var escapedPath = EscapeStringForJSX(data.path);
        return runEvalScript("fileOpen('" + escapedPath +"')")
            .then(function(result){
                log.warn("open: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_metadata', function (data) {
        log.warn('Server called client route "get_metadata":', data);
        return runEvalScript("getMetadata()")
            .then(function(result){
                log.warn("getMetadata: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_active_document_name', function (data) {
        log.warn('Server called client route ' +
            '"get_active_document_name":', data);
        return runEvalScript("getActiveDocumentName()")
            .then(function(result){
                log.warn("get_active_document_name: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_active_document_full_name', function (data){
        log.warn('Server called client route ' +
            '"get_active_document_full_name":', data);
        return runEvalScript("getActiveDocumentFullName()")
            .then(function(result){
                log.warn("get_active_document_full_name: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.add_item', function (data) {
        log.warn('Server called client route "add_item":', data);
        var escapedName = EscapeStringForJSX(data.name);
        return runEvalScript("addItem('" + escapedName +"', " +
                                     "'" + data.item_type + "')")
            .then(function(result){
                log.warn("get_items: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_items', function (data) {
        log.warn('Server called client route "get_items":', data);
        return runEvalScript("getItems("  + data.bins + "," +
                                            data.sequences + "," +
                                            data.footages + ")")
            .then(function(result){
                log.warn("get_items: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.select_items', function (data) {
        log.warn('Server called client route "select_items":', data);
        return runEvalScript("selectItems("  + JSON.stringify(data.items) + ")")
            .then(function(result){
                log.warn("select_items: " + result);
                return result;
            });
    });


    RPC.addRoute('Premiere.get_selected_items', function (data) {
        log.warn('Server called client route "get_selected_items":', data);
        return runEvalScript("getSelectedItems(" + data.comps + "," +
                                                   data.folders + "," +
                                                   data.footages  + ")")
            .then(function(result){
                log.warn("get_selected_items: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.import_files', function (data) {
        log.warn('Server called client route "import_files":', data);
        var escapedPaths = data.paths.map(path => EscapeStringForJSX(path));
        return runEvalScript("importFiles(" + JSON.stringify(escapedPaths) + ", " +
                                         "'" + data.item_name + "'," +
                                         data.is_image_sequence + ", true, true)")
            .then(function(result){
                log.warn("importFile: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.import_ae_comp', function (data) {
        log.warn('Server called client route "import_ae_comp":', data);
        var escapedPath = EscapeStringForJSX(data.path);
        var escapedCompNames = data.comp_names.map(comp_name => EscapeStringForJSX(comp_name));
        return runEvalScript("importAEComp('" + escapedPath + "', " +
                                         "'" + data.item_name + "'," +
                                         JSON.stringify(escapedCompNames) + ")")
            .then(function(result){
                log.warn("importAEComp: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.replace_ae_comp', function (data) {
        log.warn('Server called client route "replace_ae_comp":', data);
        var escapedPath = EscapeStringForJSX(data.path);
        var escapedCompNames = data.comp_names.map(comp_name => EscapeStringForJSX(comp_name));
        return runEvalScript("replaceAEComp('" + escapedPath + "', " +
                                         "'" + data.item_name + "'," +
                                         JSON.stringify(escapedCompNames) + ")")
            .then(function(result){
                log.warn("replaceAEComp: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.replace_item', function (data) {
        log.warn('Server called client route "replace_item":', data);
        var escapedPaths = data.paths.map(path => EscapeStringForJSX(path));
        return runEvalScript("replaceItem('" + data.item_id + "', " +
                                          JSON.stringify(escapedPaths) + ", " +
                                          "'" + data.item_name + "'," +
                                          data.is_image_sequence + ")")
            .then(function(result){
                log.warn("replaceItem: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.rename_item', function (data) {
        log.warn('Server called client route "rename_item":', data);
        return runEvalScript("renameItem(" + data.item_id + ", " +
                                         "'" + data.item_name + "')")
            .then(function(result){
                log.warn("renameItem: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.delete_item', function (data) {
        log.warn('Server called client route "delete_item":', data);
        return runEvalScript("deleteItem('" + data.item_id + "')")
            .then(function(result){
                log.warn("deleteItem: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.imprint', function (data) {
        log.warn('Server called client route "imprint":', data);
        var escaped = data.payload.replace(/\n/g, "\\n");
        return runEvalScript("imprint('" + escaped +"')")
            .then(function(result){
                log.warn("imprint: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.set_label_color', function (data) {
        log.warn('Server called client route "set_label_color":', data);
        return runEvalScript("setLabelColor(" + data.item_id + "," +
                                                data.color_idx + ")")
            .then(function(result){
                log.warn("imprint: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.saveAs', function (data) {
        log.warn('Server called client route "saveAs":', data);
        var escapedPath = EscapeStringForJSX(data.image_path);
        return runEvalScript("saveAs('" + escapedPath + "', " +
                                     data.as_copy + ")")
            .then(function(result){
                log.warn("saveAs: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.save', function (data) {
        log.warn('Server called client route "save":', data);
        return runEvalScript("save()")
            .then(function(result){
                log.warn("save: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_render_info', function (data) {
        log.warn('Server called client route "get_render_info":', data);
        return runEvalScript("getRenderInfo(" + data.comp_id +")")
            .then(function(result){
                log.warn("get_render_info: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.get_extension_version', function (data) {
      log.warn('Server called client route "get_extension_version":', data);
      return get_extension_version();
    });

    RPC.addRoute('Premiere.get_app_version', function (data) {
        log.warn('Server called client route "get_app_version":', data);
        return runEvalScript("getAppVersion()")
            .then(function(result){
                log.warn("get_app_version: " + result);
                return result;
            });
    });

    RPC.addRoute('Premiere.add_placeholder', function (data) {
        log.warn('Server called client route "add_placeholder":', data);
        var escapedName = EscapeStringForJSX(data.name);
        return runEvalScript("addPlaceholder('" + escapedName +"',"+
                                              data.width + ',' +
                                              data.height + ',' +
                                              data.fps + ',' +
                                              data.duration + ")")
            .then(function(result){
                log.warn("add_placeholder: " + result);
                return result;
            });
    });

     RPC.addRoute('Premiere.close', function (data) {
        log.warn('Server called client route "close":', data);
        return runEvalScript("close()");
    });

    RPC.addRoute('Premiere.print_msg', function (data) {
        log.warn('Server called client route "print_msg":', data);
        var escaped_msg = EscapeStringForJSX(data.msg);
        return runEvalScript("printMsg('" + escaped_msg +"')")
            .then(function(result){
                log.warn("print_msg: " + result);
                return result;
            });
    });
}

/** main entry point **/
startUp("WEBSOCKET_URL");

(function () {
    'use strict';

    var csInterface = new CSInterface();


    function init() {

        themeManager.init();

        $("#btn_test").click(function () {
            csInterface.evalScript('sayHello()');
        });
    }

    init();

}());

function EscapeStringForJSX(str){
    // Replaces:
    //  \ with \\
    //  ' with \'
    //  " with \"
    // See: https://stackoverflow.com/a/3967927/5285364
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g,'\\"');
}

function runEvalScript(script) {
    // because of asynchronous nature of functions in jsx
    // this waits for response
    return new Promise(function(resolve, reject){
        csInterface.evalScript(script, resolve);
    });
}