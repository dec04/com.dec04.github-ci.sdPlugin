let websocket = null;
let pluginUUID = null;

let DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 });

const GITHUB_API_URL = 'https://api.github.com/repos';
const GITHUB_WORKFLOWS_PATH = 'actions/workflows';

let keyDownTimer;
let githubUsername = '';
let githubRepo = '';
let githubWorkflow = '';
let githubToken = '';


let githubCIAction = {

    type: 'com.dec04.github-ci.action',

    onKeyDown: function (context, settings, coordinates, userDesiredState) {
        this.setState(context, 0);
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        this.fetchWorkflows(context);
    },

    onWillAppear: function (context, settings, coordinates) {
        this.checkSettings(context, settings);
        this.setTitle(context, githubRepo);
    },

    setTitle: function (context, title) {
        let json = {
            'event':   'setTitle',
            'context': context,
            'payload': {
                'title':  title,
                'target': DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        };

        websocket.send(JSON.stringify(json));
    },

    setSettings: function (context, settings) {
        let json = {
            'event':   'setSettings',
            'context': context,
            'payload': settings
        };

        websocket.send(JSON.stringify(json));
    },

    setState: async function (context, state) {
        let json = {
            'event':   'setState',
            'context': context,
            'payload': {
                'state': state
            }
        };

        websocket.send(JSON.stringify(json));
    },

    setLastError: function (context, text) {
        let payload = {
            'githubUsername':   githubUsername,
            'githubRepo':       githubRepo,
            'githubWorkflow':   githubWorkflow,
            'githubToken':      githubToken,
            'lastErrorMessage': text
        };

        this.setSettings(context, payload);
    },

    checkSettings: function (context, settings) {
        if (settings != null) {
            githubUsername = settings.hasOwnProperty('githubUsername') ? settings['githubUsername'] : '';
            githubRepo = settings.hasOwnProperty('githubRepo') ? settings['githubRepo'] : '';
            githubWorkflow = settings.hasOwnProperty('githubWorkflow') ? settings['githubWorkflow'] : '';
            githubCIAction.setTitle(context, githubRepo);
        }
    },

    fetchWorkflows: function (context) {
        const url = `${GITHUB_API_URL}/${githubUsername}/${githubRepo}/${GITHUB_WORKFLOWS_PATH}`;

        let xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Content-Type', `application/vnd.github+json`);
        xhr.setRequestHeader('Authorization', `Bearer ${githubToken}`);
        xhr.send();

        let self = this;

        xhr.onload = function (e) {

            if (xhr.status === 200) {
                self.setState(context, 5).then(() => {
                    console.log(xhr.response);
                    self.setTitle(context, githubRepo);
                    let payload = {
                        'githubUsername':   githubUsername,
                        'githubRepo':       githubRepo,
                        'githubWorkflow':   githubWorkflow,
                        'githubToken':      githubToken,
                        'lastErrorMessage': 'No errors.',
                        'workflowsIDs':     xhr.response
                    };
                    self.setSettings(context, payload);
                });
            } else {
                self.setState(context, 4).then(() => {
                    self.setTitle(context, githubRepo);
                    self.setLastError(context, xhr.response);
                });
            }
        };

        xhr.onerror = function () { // происходит, только когда запрос совсем не получилось выполнить
            console.log(`Ошибка соединения`);

            self.setState(context, 2);
        };

        xhr.onprogress = function (event) {
            // запускается периодически
            // event.loaded - количество загруженных байт
            // event.lengthComputable = равно true, если сервер присылает заголовок Content-Length
            // event.total - количество байт всего (только если lengthComputable равно true)
            self.setTitle(context, 'loading');
            self.setState(context, 1);
        };
    }
};

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;
    console.log(inInfo);

    // Open the web socket
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    function registerPlugin(inPluginUUID) {
        let json = {
            'event': inRegisterEvent,
            'uuid':  inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    }

    function requestGlobalSettings(inUUID) {
        const json = {
            'event':   'getGlobalSettings',
            'context': inUUID
        };
        websocket.send(JSON.stringify(json));
    }

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
        requestGlobalSettings(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        console.log(`onMessage: ${evt.data}`);

        let jsonObj = JSON.parse(evt.data);
        let event = jsonObj['event'];
        let action = jsonObj['action'];

        let context = jsonObj['context'];

        if (event === 'sendToPlugin') {
            let jsonPayload = jsonObj['payload'];
            if (jsonPayload.hasOwnProperty('piAction')) {
                console.log(`[sendToPlugin]: ${jsonPayload.piAction}`);
                githubCIAction.fetchWorkflows(context);
            }
        } else if (event === 'keyDown') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            githubCIAction.onKeyDown(context, settings, coordinates, userDesiredState);
        } else if (event === 'keyUp') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            githubCIAction.onKeyUp(context, settings, coordinates, userDesiredState);
        } else if (event === 'willAppear') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            githubCIAction.onWillAppear(context, settings, coordinates);
        } else if (event === 'didReceiveGlobalSettings') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            if (settings != null && settings.hasOwnProperty('githubToken')) {
                githubToken = settings['githubToken'];
            }
        } else if (event === 'didReceiveSettings') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            githubCIAction.checkSettings(context, settings);
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
}
