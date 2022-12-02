let websocket    = null,
    uuid         = null,
    actionInfo   = {};

function connectElgatoStreamDeckSocket(
    inPort,
    inPropertyInspectorUUID,
    inRegisterEvent,
    inInfo,
    inActionInfo
) {
    uuid = inPropertyInspectorUUID;
    actionInfo = JSON.parse(inActionInfo);

    websocket = new WebSocket('ws://localhost:' + inPort);

    websocket.onopen = function () {
        // WebSocket is connected, register the Property Inspector
        let json = {
            event: inRegisterEvent,
            uuid:  inPropertyInspectorUUID,
        };
        websocket.send(JSON.stringify(json));

        json = {
            event:   'getSettings',
            context: uuid,
        };
        websocket.send(JSON.stringify(json));

        json = {
            event:   'getGlobalSettings',
            context: uuid,
        };
        websocket.send(JSON.stringify(json));
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        const jsonObj = JSON.parse(evt.data);
        if (jsonObj.event === 'didReceiveSettings') {
            const payload = jsonObj.payload.settings;
            initiateInputElement('githubUsername', payload.githubUsername, '');
            initiateInputElement('githubRepo', payload.githubRepo, '');
            initiateInputElement('githubWorkflow', payload.githubWorkflow, '');
            initiateBlockElement('lastErrorMessage', payload.lastErrorMessage, '');
            initiateBlockElement('requestPoolingInterval', payload.requestPoolingInterval, '');
            addWorkflowsAsList(payload.workflowsIDs);
        }
        if (jsonObj.event === 'didReceiveGlobalSettings') {
            const payload = jsonObj.payload.settings;
            initiateInputElement('githubToken', payload.githubToken, '');
        }
    };
}

/**
 * Method add workflows to dom element requested from GitHub api
 * @param workflows id's of workflows
 */
function addWorkflowsAsList(workflows) {
    let text = '';
    workflows.forEach(workflow => {
        text += `${workflow.name}: ${workflow.id}<br/>`;
    });
    initiateBlockElement('idsBlock', '', '');
    initiateBlockElement('idsBlock', text);
}

/**
 * Method initiate dom elements with value
 * @param element id of dom element
 * @param value element value
 * @param fallback as is, fallback for value
 */
function initiateInputElement(element, value, fallback = '') {
    if (typeof value === 'undefined') {
        document.getElementById(element).value = fallback;
        return;
    }
    document.getElementById(element).value = value;
}

/**
 * Method initiate dom elements with value
 * @param element id of dom element
 * @param value element value
 * @param fallback as is, fallback for value
 */
function initiateBlockElement(element, value, fallback = '') {
    if (typeof value === 'undefined') {
        document.getElementById(element).innerHTML = fallback;
        return;
    }
    document.getElementById(element).innerHTML = value;
}

/**
 * Method send to
 * @param value value to send
 * @param param payload parameters name
 */
function sendValueToPlugin(value, param) {
    if (websocket && (websocket.readyState === 1)) {
        let payload = {};
        let settings = {};
        settings.githubUsername = document.getElementById('githubUsername').value;
        settings.githubRepo = document.getElementById('githubRepo').value;
        settings.githubWorkflow = document.getElementById('githubWorkflow').value;
        payload.settings = settings;
        payload[param] = value;

        const json = {
            'action':  actionInfo['action'],
            'event':   'sendToPlugin',
            'context': uuid,
            'payload': payload
        };
        websocket.send(JSON.stringify(json));
    }
}

/**
 * Method update stream deck settings
 */
function updateSettings() {
    if (websocket && websocket.readyState === 1) {
        let payload = {};
        payload.githubUsername = document.getElementById('githubUsername').value;
        payload.githubRepo = document.getElementById('githubRepo').value;
        payload.githubWorkflow = document.getElementById('githubWorkflow').value;
        const json = {
            event:   'setSettings',
            context: uuid,
            payload: payload,
        };
        websocket.send(JSON.stringify(json));
    }
}

/**
 * Method update stream deck global settings
 */
function updateGlobal() {
    if (websocket && websocket.readyState === 1) {
        let payload = {};
        payload.githubToken = document.getElementById('githubToken').value;

        const json = {
            event:   'setGlobalSettings',
            context: uuid,
            payload,
        };
        websocket.send(JSON.stringify(json));
    }
}

/**
 * Open external url
 * @param site web site url without schema
 */
function openPage(site) {
    if (websocket && websocket.readyState === 1) {
        const json = {
            event:   'openUrl',
            payload: {
                url: `https://${site}`,
            },
        };
        websocket.send(JSON.stringify(json));
    }
}
