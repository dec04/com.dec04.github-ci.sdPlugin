let websocket = null;
let pluginUUID = null;

let DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 });

let timer;

let counterAction = {

    type: 'com.dec04.github-ci.action',

    onKeyDown: function (context, settings, coordinates, userDesiredState) {

        timer = setTimeout(function () {
            // let updatedSettings = {};
            // updatedSettings['keyPressCounter'] = -1;
            //
            // counterAction.SetSettings(context, updatedSettings);
            // counterAction.SetTitle(context, 0);
        }, 1500);
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {

        clearTimeout(timer);

        // let keyPressCounter = 0;
        // if (settings != null && settings.hasOwnProperty('keyPressCounter')) {
        //     keyPressCounter = settings['keyPressCounter'];
        // }
        //
        // keyPressCounter++;
        //
        // let updatedSettings = {};
        // updatedSettings['keyPressCounter'] = keyPressCounter;
        //
        // this.SetSettings(context, updatedSettings);
        //
        // this.SetTitle(context, keyPressCounter);
    },

    onWillAppear: function (context, settings, coordinates) {

        // let keyPressCounter = 0;
        // if (settings != null && settings.hasOwnProperty('keyPressCounter')) {
        //     keyPressCounter = settings['keyPressCounter'];
        // }

        this.SetTitle(context, 'initialization');
    },

    SetTitle: function (context, keyPressCounter) {
        let json = {
            'event':   'setTitle',
            'context': context,
            'payload': {
                'title':  'loading',
                'target': DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        };

        websocket.send(JSON.stringify(json));
    },

    SetSettings: function (context, settings) {
        let json = {
            'event':   'setSettings',
            'context': context,
            'payload': settings
        };

        websocket.send(JSON.stringify(json));
    }
};

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;

    // Open the web socket
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    function registerPlugin(inPluginUUID) {
        let json = {
            'event': inRegisterEvent,
            'uuid':  inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    }

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        let jsonObj = JSON.parse(evt.data);
        let event = jsonObj['event'];
        let action = jsonObj['action'];
        let context = jsonObj['context'];

        if (event === 'keyDown') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            counterAction.onKeyDown(context, settings, coordinates, userDesiredState);
        } else if (event === 'keyUp') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            counterAction.onKeyUp(context, settings, coordinates, userDesiredState);
        } else if (event === 'willAppear') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            counterAction.onWillAppear(context, settings, coordinates);
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
}
