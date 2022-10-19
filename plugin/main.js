let websocket = null;
let pluginUUID = null;

let DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 });

const GITHUB_API_URL = 'https://api.github.com/repos';
const GITHUB_WORKFLOWS_PATH = 'actions/workflows';

let periodTimer;
let timerFlag = false;
let githubUsername = '';
let githubRepo = '';
let githubWorkflow = '';
let githubToken = '';
let requestPoolingInterval = 10000;


let githubCIAction = {

    type: 'com.dec04.github-ci.action',

    onKeyDown: function (context, settings, coordinates, userDesiredState) {
        this.setState(context, 0);
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        this.checkBeforeRequest(context, settings).then(isCorrect => {
            if (isCorrect) {
                this.fetchWorkflow(context);
            }
        });
    },

    onWillAppear: function (context, settings, coordinates) {
        this.checkSettings(context, settings);
        this.setTitle(context, githubRepo);
        this.fetchWorkflow(context);
    },

    onWillDisappear: function (context, settings, coordinates) {
        clearInterval(periodTimer);
        timerFlag = false;
        console.log('Timer clear');
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
            requestPoolingInterval = settings.hasOwnProperty('requestPoolingInterval') ? settings['requestPoolingInterval'] : 10000;
            githubCIAction.setTitle(context, githubRepo);
        }
    },

    checkBeforeRequest: async function (context, settings) {
        if (settings != null) {
            if (githubUsername === '' ||
                githubRepo === '' ||
                githubWorkflow === '' ||
                githubToken === '') {
                console.log(githubUsername, githubRepo, githubWorkflow, githubToken);
                this.setState(context, 2).then(() => this.setTitle(context, 'SETTINGS!'));
                this.setLastError(context, `Check settings!<br/>githubUsername: ${githubUsername}<br/> githubRepo: ${githubRepo}<br/> githubWorkflow: ${githubWorkflow}<br/> githubToken: ${githubToken}<br/>`);
                return false;
            } else {
                return true;
            }
        } else {
            return false;
        }
    },

    fetchWorkflows: function (context) {
        const url = `${GITHUB_API_URL}/${githubUsername}/${githubRepo}/${GITHUB_WORKFLOWS_PATH}`;

        let self = this;

        this.sendRequest(context, url, (xhr) => {
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
        });
    },

    fetchWorkflow: async function (context) {
        const url = `${GITHUB_API_URL}/${githubUsername}/${githubRepo}/${GITHUB_WORKFLOWS_PATH}/${githubWorkflow}/runs`;

        let self = this;

        this.sendRequest(context, url, (xhr) => {
            console.log(xhr.response);

            let responseJson = JSON.parse(xhr.response);
            let runs = responseJson.workflow_runs;

            if (responseJson.total_count > 0) {
                if (runs[0].status === 'completed') {
                    self.setState(context, 3).then(() => self.setTitle(context, githubRepo));
                    clearInterval(timerFlag);
                    timerFlag = false;
                } else if (runs[0].status === 'cancelled' ||
                    runs[0].status === 'action_required' ||
                    runs[0].status === 'failure' ||
                    runs[0].status === 'neutral') {
                    self.setState(context, 6).then(() => self.setTitle(context, githubRepo));
                    clearInterval(timerFlag);
                    timerFlag = false;
                } else if (runs[0].status === 'in_progress' ||
                    runs[0].status === 'queued' ||
                    runs[0].status === 'requested' ||
                    runs[0].status === 'waiting') {
                    self.setState(context, 7).then(() => self.setTitle(context, githubRepo));
                    if (!timerFlag) {
                        periodTimer = setInterval(() => self.fetchWorkflow(context), 15000);
                        timerFlag = true;
                    }
                }

                self.setLastError(context, runs[0].status);
            } else {
                self.setState(context, 4).then(() => {
                    self.setTitle(context, 'Check errors!');
                    self.setLastError(context, `No runs for this workflow id [${githubWorkflow}]`);
                });
                clearInterval(timerFlag);
                timerFlag = false;
            }
            //  IMPORTANT: Status can be completed, action_required, cancelled, failure, neutral,
            //   skipped, stale, success, timed_out, in_progress, queued, requested, waiting
        });
    },

    sendRequest: function (context, url, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Content-Type', `application/vnd.github+json`);
        xhr.setRequestHeader('Authorization', `Bearer ${githubToken}`);
        xhr.send();

        let self = this;

        xhr.onload = function (e) {
            if (xhr.status === 200) {
                callback(xhr);
            } else {
                self.setState(context, 4).then(() => {
                    self.setTitle(context, githubRepo);
                    self.setLastError(context, xhr.response);
                });
            }
        };

        xhr.onerror = function () { // происходит, только когда запрос совсем не получилось выполнить
            console.log(`Ошибка соединения`);

            self.setState(context, 2).then(() => self.setTitle(context, 'SETTINGS!'));
        };

        xhr.onprogress = function (event) {
            // запускается периодически
            // event.loaded - количество загруженных байт
            // event.lengthComputable = равно true, если сервер присылает заголовок Content-Length
            // event.total - количество байт всего (только если lengthComputable равно true)
            self.setState(context, 1).then(() => self.setTitle(context, 'loading'));
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
        } else if (event === 'willDisappear') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            githubCIAction.onWillDisappear(context, settings, coordinates);
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
