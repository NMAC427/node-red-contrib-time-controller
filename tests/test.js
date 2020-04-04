/* eslint-disable max-lines,max-lines-per-function */
/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 @koslo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const {
    assert,
} = require('chai')
const data = require('../example.json')
const _ = require('lodash')
const sunCalc = require('suncalc')
const mock = require('node-red-contrib-mock-node')
const nodeRedModule = require('../index.js')
let activeNode

function newNode(configOverrides) {
    let config = {
        name    : 'test-node',
        interval: 1,
        data    : JSON.stringify(data),
    }
    if (configOverrides) {
        _.assign(config, configOverrides)
    }
    return mock(nodeRedModule, config)
}

function createNodeAndEmit(payload, overrides = null) {
    let node = newNode(overrides)
    node.emit('input', {
        payload: payload,
    })

    activeNode = node

    return node
}

function hook(root, payload, cb) {
    const timeout = 1
    let node = createNodeAndEmit(payload)

    root.timeout((timeout + 10) * 1000)

    setTimeout(() => {
        cb(node)
    }, timeout * 1000)
}

function createData(data) {
    return JSON.stringify([
        _.merge({
            'start': {
                'time' : '00:00',
                'value': 0,
            },
            'end'  : {
                'time' : '00:00',
                'value': 0,
            },
            'topic': 'topic',
        }, data),
    ])
}

describe('time-controller', () => {

    afterEach(() => {
        activeNode && activeNode.emit('close') && (activeNode = null)
    })

    it('should validate start is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'end'  : {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'start is undefined')
    })

    it('should validate start time is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'start': {
                        'value': 0,
                    },
                    'end'  : {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'start time is undefined')
    })

    it('should validate start value is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'start': {
                        'time': '00:00',
                    },
                    'end'  : {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'start value is undefined')
    })

    it('should validate end is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'start': {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'end is undefined')
    })

    it('should validate end time is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'end'  : {
                        'value': 0,
                    },
                    'start': {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'end time is undefined')
    })

    it('should validate end value is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'end'  : {
                        'time': '00:00',
                    },
                    'start': {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'topic': 'topic',
                },
            ]),
        })
        assert.equal(activeNode.error(), 'end value is undefined')
    });

    ['start', 'end'].forEach((key) => {
        [
            {
                v: null,
                e: key + ' value is not a number; given: null',
            },
            {
                v: '',
                e: key + ' value is not a number; given: ',
            },
            {
                v: 'string',
                e: key + ' value is not a number; given: string',
            },
        ].forEach((item) => {
            it('should validate ' + key + ' value with: ' + item.v, () => {
                const data = {}
                data[key] = {
                    value: item.v,
                }
                activeNode = newNode({
                    data: createData(data),
                })
                assert.equal(activeNode.error(), item.e)
            })
        });

        [
            {
                v: null,
                e: key + ' time should be a string of format hh:mm or a sun event; given: null',
            },
            {
                v: '',
                e: key + ' time should be a string of format hh:mm or a sun event; given: ',
            },
            {
                v: 'string',
                e: key + ' time should be a string of format hh:mm or a sun event; given: string',
            },
            {
                v: '0:a',
                e: key + ' time should be a string of format hh:mm or a sun event; given: 0:a',
            },
            {
                v: 'solarrNoon',
                e: key + ' time should be a string of format hh:mm or a sun event; given: solarrNoon',
            },
        ].forEach((item) => {
            it('should validate ' + key + ' time with: ' + item.v, () => {
                const data = {}
                data[key] = {
                    time: item.v,
                }
                activeNode = newNode({
                    data: createData(data),
                })
                assert.equal(activeNode.error(), item.e)
            })
        })
    })

    it('should validate topic is undefined', () => {
        activeNode = newNode({
            data: JSON.stringify([
                {
                    'start': {
                        'time' : '00:00',
                        'value': 0,
                    },
                    'end'  : {
                        'time' : '00:00',
                        'value': 0,
                    },
                },
            ]),
        })
        assert.equal(activeNode.error(), 'topic is undefined')
    })

    it('should be off with payload off', function (done) {
        hook(this,
            'off',
            (node) => {
                assert.equal(node.status().text, 'stopped')

                node.emit('input', {
                    payload: 'off',
                })
                done()
            })
    })

    it('should be on with payload on', function (done) {
        hook(this,
            'on',
            (node) => {
                assert.notEqual(node.status().text, 'stopped')

                done()
            })
    })

    it('should be on [0, 3, 0, 0] at 04:45', () => {
        const node = createNodeAndEmit('04:45')

        assert.equal(node.status().text, 'running [0, 3, 0, 0]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(node.sent(0).payload, 3)
    })

    it('should be on [50, 50, 0, 0] at 06:15', () => {
        const node = createNodeAndEmit('06:15')

        assert.equal(node.status().text, 'running [50, 50, 0, 0]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 50)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(node.sent(1).payload, 50)
    })

    it('should be on [50, 0, 15, 50] at 06:45', () => {
        const node = createNodeAndEmit('06:45')

        assert.equal(node.status().text, 'running [50, 0, 15, 50]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 50)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(node.sent(1).payload, 15)
        assert.equal(node.sent(2).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(node.sent(2).payload, 50)
    })

    it('should be on [0, 0, 30, 100] at 07:00', () => {
        const node = createNodeAndEmit('07:00')

        assert.equal(node.status().text, 'running [0, 0, 30, 100]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 0)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(node.sent(1).payload, 30)
        assert.equal(node.sent(2).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(node.sent(2).payload, 100)
    })

    it('should be on [0, 0, 100, 100] at 11:00', () => {
        const node = createNodeAndEmit('11:00')

        assert.equal(node.status().text, 'running [0, 0, 100, 100]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(node.sent(0).payload, 100)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(node.sent(1).payload, 100)
    })

    it('should be on [0, 0, 0, 0] at 12:30', () => {
        const node = createNodeAndEmit('12:30')

        assert.equal(node.status().text, 'running [0, 0, 0, 0]')
        assert.isUndefined(node.sent(0))
    })

    it('should be on [0, 0, 10, 80] at 20:30', () => {
        const node = createNodeAndEmit('20:30')

        assert.equal(node.status().text, 'running [0, 0, 10, 80]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 0)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(node.sent(1).payload, 10)
        assert.equal(node.sent(2).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(node.sent(2).payload, 80)
    })

    it('should be on [52, 50, 0, 0] at 21:15', () => {
        const node = createNodeAndEmit('21:15')

        assert.equal(node.status().text, 'running [52, 50, 0, 0]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 52)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(node.sent(1).payload, 50)
    })

    it('should be on [100, 0, 0, 0] at 21:00', () => {
        const node = createNodeAndEmit('21:00')

        assert.equal(node.status().text, 'running [100, 0, 0, 0]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 100)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(node.sent(1).payload, 0)
    })

    it('should be on [0, 100, 0, 0] at 21:30', () => {
        const node = createNodeAndEmit('21:30')

        assert.equal(node.status().text, 'running [0, 100, 0, 0]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(node.sent(0).payload, 0)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(node.sent(1).payload, 100)
    })

    it('should be on [0, 0, 100, 100] at 17:30', () => {
        const node = createNodeAndEmit('17:30')

        assert.equal(node.status().text, 'running [0, 0, 100, 100]')
        assert.equal(node.sent(0).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(node.sent(0).payload, 100)
        assert.equal(node.sent(1).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(node.sent(1).payload, 100)
    })

    it('should be on [0, 0, 0, 0] at 11:30', () => {
        activeNode = newNode({
            usePreviousEventOnReload: 'true',
            overrideNow             : '11:30',
        })

        assert.equal(activeNode.status().text, 'running [0, 0, 0, 0]')
        assert.equal(activeNode.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(activeNode.sent(0).payload, 0)
        assert.equal(activeNode.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(activeNode.sent(1).payload, 0)
        assert.equal(activeNode.sent(2).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(activeNode.sent(2).payload, 0)
        assert.equal(activeNode.sent(3).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(activeNode.sent(3).payload, 0)
    })

    it('should be on [0, 3, 0, 0] at 23:59', () => {
        activeNode = newNode({
            usePreviousEventOnReload: 'true',
            overrideNow             : '23:59',
        })

        assert.equal(activeNode.status().text, 'running [0, 3, 0, 0]')
        assert.equal(activeNode.sent(0).topic, 'wz_aq_rgbw/cmnd/channel1')
        assert.equal(activeNode.sent(0).payload, 0)
        assert.equal(activeNode.sent(1).topic, 'wz_aq_rgbw/cmnd/channel3')
        assert.equal(activeNode.sent(1).payload, 3)
        assert.equal(activeNode.sent(2).topic, 'wz_aq_rgbw/cmnd/channel4')
        assert.equal(activeNode.sent(2).payload, 0)
        assert.equal(activeNode.sent(3).topic, 'wz_aq_rgbw/cmnd/channel5')
        assert.equal(activeNode.sent(3).payload, 0)
    })

    it('should be stopped at 23:59 with usePreviousEventOnReload != true', () => {
        activeNode = newNode({
            overrideNow: '23:59',
        })

        assert.notEqual(activeNode.status().text, 'running [0, 3, 0, 0]')
        assert.isUndefined(activeNode.sent(0))
        assert.isUndefined(activeNode.sent(1))
        assert.isUndefined(activeNode.sent(2))
        assert.isUndefined(activeNode.sent(3))
    })

    //todo check interval
})