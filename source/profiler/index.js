/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const error = require('./lib/error.js');

exports.handler = async (event) => {
    console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

    const dynamo = DynamoDBDocument.from(new DynamoDBClient({ 
        region: process.env.AWS_REGION,
        customUserAgent: process.env.SOLUTION_IDENTIFIER
    }));

    try {
        // Download DynamoDB data for the source file:
        let params = {
            TableName: process.env.DynamoDBTable,
            Key: {
                guid: event.guid
            }
        };

        let data = await dynamo.get(params);

        Object.keys(data.Item).forEach(key => {
            event[key] = data.Item[key];
        });

        let mediaInfo = JSON.parse(event.srcMediainfo);
        event.srcHeight = mediaInfo.video[0].height;
        event.srcWidth = mediaInfo.video[0].width;

        // Determine orientation
        if (event.srcWidth >= event.srcHeight) {
            event.orientation = 'landscape';
            event.srcMaxDimension = event.srcWidth;
            event.srcMinDimension = event.srcHeight;
        } else {
            event.orientation = 'portrait';
            event.srcMaxDimension = event.srcHeight;
            event.srcMinDimension = event.srcWidth;
        }

        // Define encoding profiles
        const profiles = [
            { 
                landscape: { width: 3840, height: 2160, templateSuffix: '2160p_landscape' },
                portrait: { width: 2160, height: 3840, templateSuffix: '2160p_portrait' }
            },
            { 
                landscape: { width: 1920, height: 1080, templateSuffix: '1080p_landscape' },
                portrait: { width: 1080, height: 1920, templateSuffix: '1080p_portrait' }
            },
            { 
                landscape: { width: 1280, height: 720, templateSuffix: '720p_landscape' },
                portrait: { width: 720, height: 1280, templateSuffix: '720p_portrait' }
            }
        ];

        // Determine encoding profile by matching the srcMaxDimension to the nearest profile
        let lastProfileDifference = Number.MAX_VALUE;
        let encodeProfile;

        profiles.forEach(profile => {
            const profileDimension = profile[event.orientation].width;
            const difference = Math.abs(event.srcMaxDimension - profileDimension);

            if (difference < lastProfileDifference) {
                lastProfileDifference = difference;
                encodeProfile = profile[event.orientation];
            }
        });

        event.encodingProfile = encodeProfile;

        if (event.frameCapture) {
            event.frameCaptureHeight = encodeProfile.height;
            event.frameCaptureWidth = encodeProfile.width;
        }

        // Use the appropriate job template based on the encoding profile and orientation
        if (!event.jobTemplate) {
            // Generate the jobTemplate key
            const jobTemplateKey = `jobTemplate_${encodeProfile.templateSuffix}`;
            event.jobTemplate = event[jobTemplateKey];
            console.log(`Chosen template:: ${event.jobTemplate}`);

            event.isCustomTemplate = false;
        } else {
            event.isCustomTemplate = true;
        }
    } catch (err) {
        await error.handler(event, err);
        throw err;
    }

    console.log(`RESPONSE:: ${JSON.stringify(event, null, 2)}`);
    return event;
};
