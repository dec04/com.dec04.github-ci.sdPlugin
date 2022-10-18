let websocket = null,
    uuid = null,
    actionInfo = {};

function connectElgatoStreamDeckSocket(
    inPort,
    inPropertyInspectorUUID,
    inRegisterEvent,
    inInfo,
    inActionInfo
) {
    uuid = inPropertyInspectorUUID;
    actionInfo = JSON.parse(inActionInfo);

    websocket = new WebSocket("ws://localhost:" + inPort);

    websocket.onopen = function () {
        // WebSocket is connected, register the Property Inspector
        let json = {
            event: inRegisterEvent,
            uuid: inPropertyInspectorUUID,
        };
        websocket.send(JSON.stringify(json));

        json = {
            event: "getSettings",
            context: uuid,
        };
        websocket.send(JSON.stringify(json));

        json = {
            event: "getGlobalSettings",
            context: uuid,
        };
        websocket.send(JSON.stringify(json));
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        const jsonObj = JSON.parse(evt.data);
        if (jsonObj.event === "didReceiveSettings") {
            const payload = jsonObj.payload.settings;
            initiateElement("githubUsername", payload.githubUsername, '');
            initiateElement("githubRepo", payload.githubRepo, '');
            initiateElement("githubWorkflow", payload.githubWorkflow, '');
        }
        if (jsonObj.event === "didReceiveGlobalSettings") {
            const payload = jsonObj.payload.settings;
            initiateElement("githubToken", payload.githubToken, '');
        }
    };
}

function initiateElement(element, value, fallback = "") {
    if (typeof value === "undefined") {
        document.getElementById(element).value = fallback;
        return;
    }
    document.getElementById(element).value = value;
}

function updateSettings() {
    if (websocket && websocket.readyState === 1) {
        let payload = {};
        payload.githubUsername = document.getElementById("githubUsername").value;
        payload.githubRepo = document.getElementById("githubRepo").value;
        payload.githubWorkflow = document.getElementById("githubWorkflow").value;
        const json = {
            event: "setSettings",
            context: uuid,
            payload: payload,
        };
        websocket.send(JSON.stringify(json));
    }
}

function updateGlobal() {
    if (websocket && websocket.readyState === 1) {
        let payload = {};
        payload.githubToken = document.getElementById("githubToken").value;

        const json = {
            event: "setGlobalSettings",
            context: uuid,
            payload,
        };
        websocket.send(JSON.stringify(json));
    }
}

function openPage(site) {
    if (websocket && websocket.readyState === 1) {
        const json = {
            event: "openUrl",
            payload: {
                url: `https://${site}`,
            },
        };
        websocket.send(JSON.stringify(json));
    }
}
