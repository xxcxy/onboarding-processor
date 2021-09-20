/**
 * Contains generic helper methods
 */

const config = require('config')
const request = require('superagent')
const logger = require('./logger')
const _ = require('lodash')
const m2mAuth = require('tc-core-library-js').auth.m2m

let m2m

/**
 * Get Kafka options
 * @return {Object} the Kafka options
 */
function getKafkaOptions () {
  const options = { connectionString: config.KAFKA_URL, groupId: config.KAFKA_GROUP_ID }
  if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
    options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
  }
  return options
}

/*
 * Function to get M2M token
 * @returns {Promise}
 */
async function getM2MToken () {
  if (!m2m) {
    m2m = m2mAuth(_.pick(config.auth0, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'AUTH0_PROXY_SERVER_URL']))
  }
  return m2m.getMachineToken(config.auth0.AUTH0_CLIENT_ID, config.auth0.AUTH0_CLIENT_SECRET)
}

/**
 * This function retrieves the user handle corresponding to the given user id
 *
 * @param {Number} userId The id of the user for whome to get the handle
 * @returns The user handle identified by the given userId
 *
 */
async function getHandleByUserId (userId) {
  logger.debug({ component: 'helper', context: 'getHandleByUserId', message: `userId: ${userId}` })

  const { body: result } = await request.get(`${config.MEMBER_API_URL}?userId=${userId}&fields=handle`)

  if (result.length === 0) { // user with the given id does not exist
    const err = new Error(`User with id ${userId} does not exist`)
    logger.logFullError(err, { component: 'helper' })
    throw err
  } else {
    return result[0].handle
  }
}

/**
 * Gets the member traits for the given trait id and member handle
 *
 * @param {String} handle The member handle for whome to get the traits
 * @param {String} traitId The string identifier of the traits to get for the member
 * @returns {Promise} The member traits promise
 */
async function getMemberTraits (handle, traitId) {
  logger.debug({ component: 'helper', context: 'getMemberTraits', message: `{ handle: ${handle}, traitId : ${traitId} }` })

  const token = await getM2MToken()

  const { body: traits } = await request
    .get(`${config.MEMBER_API_URL}/${handle}/traits?traitIds=${traitId}`)
    .set('Authorization', `Bearer ${token}`)
  return traits
}

/**
 * Saves the given member traits body data for the user identified by the specified handle
 * This function supports creating new traits or updating existing traits based on 'isCreate' parameter
 *
 * @param {String} handle The member for whome to create/update the traits
 * @param {Object} body The request body to use for creating/updating the traits
 * @param {Boolean} isCreate The flag indicating whether to create or update the traits
 */
async function saveMemberTraits (handle, body, isCreate) {
  logger.debug({
    component: 'helper',
    context: 'saveMemberTraits',
    message: `{ handle: ${handle}, body: ${JSON.stringify(body)}, isCreate: ${isCreate}}`
  })

  const token = await getM2MToken()

  // Determine the HTTP method to use based on the isCreate flag
  const httpMethod = isCreate ? 'post' : 'put'

  // Send the post/put request to the member traits api
  await request[httpMethod](`${config.MEMBER_API_URL}/${handle}/traits`)
    .send(body)
    .set('Authorization', `Bearer ${token}`)
}

module.exports = {
  getKafkaOptions,
  getM2MToken,
  getHandleByUserId,
  getMemberTraits,
  saveMemberTraits
}