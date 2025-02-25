const CalculationFactory = require('./Calculation/Factory')
const Preparation = require('./Preparation')
const moment = require('moment')
const sunCalc = require('suncalc')
const _ = require('lodash')

/**
 * TimeController
 */
class TimeController {
  /**
   * @param {object} node
   * @param {object} config
   *
   */
  constructor (node, config) {
    /**
     * instance of node
     */
    this.node = node

    this.sunCalcTimes = require('./SunCalcTimes')

    /**
     * time config
     */
    this.config = config

    /**
     * interval to check events
     */
    this.interval = null

    /**
     * node status
     */
    this.status = {}

    this.initEvents()
  }

  /**
   *
   */
  init () {
    const preparation = new Preparation(JSON.parse(this.config.data))

    this.status = preparation.getStatus()
    const errors = preparation.getErrors()
    if (!_.isEmpty(errors)) {
      this.error(errors)
    }

    this.node.data = preparation.getData()

    this.config.interval = this.config.interval || 1
    this.config.granularity = this.config.interval < 60 ? 'second' : this.config.interval < 60 * 60 ? 'minute' : 'hour'
    this.config.usePreviousEventOnReload = (this.config.usePreviousEventOnReload + '').toLowerCase() === 'true'
    this.config.outputAsRgbValue = (this.config.outputAsRgbValue + '').toLowerCase() === 'true'

    // for testing, no offset
    if (this.config.overrideNow) {
      const now = this.createMoment(this.config.overrideNow)
      if (moment.isMoment(now)) {
        this.node.now = () => now
      }
    }
  }

  /**
   *
   */
  sendPreviousEvents () {
    const now = this.node.now()
    const previousEvent = {}

    // todo find a solution if it is in the early morning and we have to find the last event
    this.node.data.forEach(event => {
      event.end.moment = this.createMoment(event.end.time, _.get(event.end, 'offset', 0))
      if (event.end.moment && event.end.moment.isSameOrBefore(now, this.config.granularity)) {
        previousEvent[event.topic] = event
      }
    })

    _.forEach(previousEvent, event => {
      this.send({
        payload: event.end.value,
        topic: event.topic
      })
      this.status[event.topic] = event.end.value
    })

    this.setStatus()
  }

  /**
   *
   * @param {string} time format 'hh:mm'
   */
  parseTime (time) {
    const matches = /(\d+):(\d+)(:(\d+))?/u.exec(time)
    if (matches && matches.length) {
      return {
        h: +matches[1],
        m: +matches[2],
        s: +matches[4] || 0
      }
    }
    return false
  }

  /**
   *
   * @param {string} time format 'hh:mm' or sunlight times (@see sunCalcTimes)
   * @param {int} offset in minutes
   *
   * @return {moment}
   */
  createMoment (time, offset = 0) {
    let newMoment = null
    if (_.has(this.sunCalcTimes, time)) {
      newMoment = moment(this.sunCalcTimes[time]).add(offset, 'm')
    } else {
      time = this.parseTime(time)
      if (!time) {
        return null
      }
      newMoment = moment().hour(time.h).minute(time.m + offset).second(time.s)
    }

    newMoment.millisecond(0)

    switch (this.config.granularity) {
      case 'minute':
        newMoment.second(0)
        break
      case 'hour':
        newMoment.second(0)
        newMoment.minute(0)
        break
    }

    return newMoment
  }

  /**
   *
   * @param {{payload}} msg
   */
  schedule (msg) {
    let now = this.node.now()
    if (msg && moment.isMoment(msg.payload)) {
      now = msg.payload
    }
    now.millisecond(0)

    this.sunCalcTimes = sunCalc.getTimes(now, this.config.lat, this.config.lng)

    this.node.data.forEach(event => {
      event.start.moment = this.createMoment(event.start.time, _.get(event.start, 'offset', 0))
      event.end.moment = this.createMoment(event.end.time, _.get(event.end, 'offset', 0))
      if (event.start.moment && event.end.moment && now.isBetween(event.start.moment, event.end.moment, this.config.granularity, '[]')) {
        msg = {
          payload: CalculationFactory(now, event, this.config.outputAsRgbValue).getData(),
          topic: event.topic
        }

        this.send(msg)
        this.status[msg.topic] = msg.payload
      }
    })
    this.setStatus()
  }

  /**
   *
   * @param {{shape: string, text: string, fill: string}} payload
   */
  setStatus (payload = null) {
    if (!payload) {
      payload = {
        fill: 'green',
        shape: 'dot',
        text: 'running [' + _.values(this.status).join(', ') + ']'
      }
    }
    this.node.status(payload)
  }

  /**
   *
   * @param {{payload: int|int[], topic: string}} msg
   */
  send (msg) {
    this.node.send(msg)
  }

  /**
   *
   * @param {string|[]} error
   */
  error (error) {
    this.node.error(error)
  }

  /**
   *
   */
  run () {
    this.interval = setInterval(
      () => this.schedule(),
      this.config.interval * 1000
    )
  }

  /**
   *
   */
  start () {
    this.stop()
    this.init()
    this.config.usePreviousEventOnReload && this.sendPreviousEvents()
    this.run()
  }

  /**
   *
   */
  stop () {
    this.setStatus({
      fill: 'red',
      shape: 'ring',
      text: 'stopped'
    })
    clearInterval(this.interval)
    delete this.interval
  }

  /**
   *
   */
  initEvents () {
    this.node.on('input', (msg) => {
      // todo config via payload?
      if (msg.payload === 'on') {
        this.start()
      } else if (msg.payload === 'off') {
        this.stop()
      } else {
        // todo offset?
        msg.payload = this.createMoment(msg.payload)
        if (moment.isMoment(msg.payload)) {
          this.init()
          this.stop()
          this.schedule(msg)
        }
      }
    })

    this.node.on('close', () => {
      this.stop()
    })

    // to allow testing
    this.node.now = () => moment().millisecond(0)
  }
}

module.exports = TimeController
