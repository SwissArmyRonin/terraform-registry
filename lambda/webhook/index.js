const crypto = require('crypto');
const AWS = require('aws-sdk');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

//const dynamo = new AWS.DynamoDB.DocumentClient();
//const s3 = new AWS.S3();

/**
 * Terraform registry implementation.
 * 
 * @param {*} event 
 * @param {*} context 
 */
exports.handler = async (event, context) => {
    if (process.env.DEBUG) {
        console.log('Received event:', JSON.stringify(event));
    }

    let body;
    let statusCode = '200';

    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        // Validate HMAC header
        const xHubSignature = event.headers['x-hub-signature'];
        let expected;
        try {
            expected = "sha1=" + crypto.createHmac('sha1', process.env.GITHUB_SECRET).update(event.body).digest('hex');
        } catch (err) {
            expected = "ERROR"; // This causes a signature validation error below
        }

        if (xHubSignature != expected) {
            if (process.env.DEBUG) {
                console.log('xHubSignature', xHubSignature);
                console.log('expected', expected);
            }
            const err = new Error("Invalid signature header");
            err.statusCode = 401;
            throw err;
        }
        
        const request = JSON.parse(event.body);

        // Process request
        if (request.ref_type != "tag") {
            const err = new Error("Not a new tag event");
            err.statusCode = 400;
            throw err;
        }

        const clone_url = request.repository.clone_url
        const ref = request.ref;

        const { stdout, stderr } = await exec(`. ${process.env.LAMBDA_TASK_ROOT}/mirror.sh "${clone_url}" "${ref}"`);
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);

        body = "OK";
    } catch (err) {
        if (process.env.DEBUG) {
            console.log(err.toString(), err.stack);
        }
        body = err.message;
        statusCode = err.statusCode || 500;
    }

    return { statusCode, body, headers };
};