// noinspection DuplicatedCode

let websocket    = null,
    uuid         = null,
    inActionInfo = null,
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
            prepareWorkflowsBlock(payload.workflowsIDs);
        }
        if (jsonObj.event === 'didReceiveGlobalSettings') {
            const payload = jsonObj.payload.settings;
            initiateInputElement('githubToken', payload.githubToken, '');
        }
    };
}

function prepareWorkflowsBlock(workflowsIDs) {
    document.getElementById('idsBlock').innerHTML = '';
    let pl = JSON.parse(workflowsIDs);
    let messageEl = document.createElement('div');
    messageEl.className = '';
    addWorkflowsAsList(pl.workflows);
}

function addWorkflowsAsList(workflows) {
    workflows.forEach(workflow => {
        let pEl = document.createElement('p');
        pEl.innerHTML = `${workflow.name}: ${workflow.id}`;
        appendToElement('idsBlock', pEl);
    });
}

function sendValueToPlugin(value, param) {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'action':  actionInfo['action'],
            'event':   'sendToPlugin',
            'context': uuid,
            'payload': {
                [param]: value
            }
        };
        websocket.send(JSON.stringify(json));
    }
}

function initiateInputElement(element, value, fallback = '') {
    if (typeof value === 'undefined') {
        document.getElementById(element).value = fallback;
        return;
    }
    document.getElementById(element).value = value;
}

function initiateBlockElement(element, value, fallback = '') {
    if (typeof value === 'undefined') {
        document.getElementById(element).innerHTML = fallback;
        return;
    }
    document.getElementById(element).innerHTML = value;
}

function appendToElement(element, node) {
    document.getElementById(element).appendChild(node);
}

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
