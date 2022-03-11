import { MachineConfig, send, Action, assign } from "xstate";
function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const rasaurl = 'https://intentrecognitionlab.herokuapp.com/model/parse'
const nluRequest = (text: string) =>
    fetch(new Request(rasaurl, {
        method: 'POST',
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());

const grammar: { [index: string]: { intent?: string,yes?: string, no?: string, help?: string } } = {
    "vacuum": { intent: "vacuum" },
    "move_to_trash": { intent: "move this to trash" },
    "give": { intent: "give this to you" },
    "turn_on_light": { intent: "turn the lights on" },
    "turn_off_light": { intent: "turn the lights off" },
    "do_dishes": { intent: "do the dishes" },
    "ask_oven_warm": { intent: "check if the oven is warm" },
    "inform_oven_warm": { intent: "remember that the oven is warm" },
    "Yes.": { yes: "Yes" },
    "Yeah.": { yes: "Yeah"},
    "Of course.": { yes: "ofcourse" },
    "No way.": { no: "no way" },
    "No.": { no: "No" },
    "Help.": {help: "help"},
    "Help me.": {help: "help me"}
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    entry: assign({ count: (context) => 0 }),
    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'rasa_intent_app',
                CLICK: 'rasa_intent_app',
            }
        },
        rasa_intent_app: {
            initial: 'prompt',
            on:{
                RECOGNISED:[
                    {
                        //if the user intent confidence is > threshold confidence
                        target: '.user',
                        cond: (context) => context.recResult[0].confidence > 0.8,
                        actions: [assign({ username: (context) => context.recResult[0].utterance,}), 
                                  assign({count: (context) => 0}) ]      
                    },
                    {
                        //if not
                        target:'.greeting_confirmation',
                        cond: (context) => context.recResult[0].confidence < 0.8,
                        actions: assign({ username: (context) => context.recResult[0].utterance})
                    },
                ],
                ENDSPEECH: { target: '.ask_intent' },
            },
            states: {
                prompt: {
                    entry:say('What is your name?'),
                    on: { ENDSPEECH: 'ask' },                    
                },
                ask: {
                    entry: send('LISTEN'),
                },
                
                user: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Hi, ${context.username}`
                    })),
                },
                greeting_confirmation:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.rasa_intent_app.user',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.rasa_intent_app.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.username}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    }
                },
                ask_intent:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target: 'get_intent',
                                actions: assign({ count: (context) => 0 }),
                            } 
                        ],
                        TIMEOUT: { 
                            target: '.prompt' ,
                            actions: assign({ count: (context) => context.count + 1 }), 
                        }
                    },
                    states:{
                        prompt:{
                            entry:say('What do you want to do?'),
                            on:{ENDSPEECH:'ask'},
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                        nomatch: {
                            entry: say("Sorry, I don't know what it is. Tell me something I know."),
                            on: { ENDSPEECH: 'prompt' }
                        },
                    }
                },
                get_intent:{
                    invoke: {
                        //id: 'identifyIntent',
                        src: (context, event) => nluRequest(context.recResult[0].utterance),
                        onDone: {
                            target: 'confirmation',
                            actions: [(context, event) => console.log(context, event), 
                                      assign({ intent: (context, event) => event.data.intent.name }), 
                                      assign({ title: (context) => grammar[context.intent].intent! })]
                        },
                        onError: {
                            target: 'ask_intent'
						}

					}
                },
                confirmation:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'final',
                                cond: (context) => "yes" in (grammar[context.recResult[0].utterance] || {}),
                                actions: assign({ count: (context) => 0 })
                            },
                            {
                                target: 'ask_intent',
                                cond: (context) => "no" in (grammar[context.recResult[0].utterance] || {}),
                                actions: assign({ count: (context) => 0 })
                            },
                            {
                                target:'.nomatch',
                                actions: assign({ count: (context) => context.count + 1 }),
                            },
                        ],
                        TIMEOUT: { actions: assign({ count: (context) => context.count + 1 }), target: '.prompt' }
                    },
                    states:{
                        prompt: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `${context.username}, do you want me to ${context.title}`
                            })),
                            on: { ENDSPEECH: 'ask' }
                        },
                        ask:{
                            entry: send('LISTEN'),
                        },
                        nomatch: {
                            entry: say("Sorry, I didn't get it."),
                            on: { ENDSPEECH: 'prompt' }
                        }
                    },
                },
                final:{
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `${context.title}!`
                    })),
                    on: { ENDSPEECH: '#root.dm.init' }
                }
            }
        },
        },
})