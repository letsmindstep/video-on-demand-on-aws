// index.js
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
        // Step 1: Fetch Event Data from DynamoDB
        const eventData = await fetchEventData(dynamo, event);

        // Step 2: Parse Media Info
        const parsedEvent = parseMediaInfo(eventData);

        // Step 3: Determine Video Orientation
        const orientedEvent = determineOrientation(parsedEvent);

        // Step 4: Select Encoding Profile
        const profiledEvent = selectEncodingProfile(orientedEvent);

        // Step 5: Set Frame Capture Dimensions
        const frameEvent = setFrameCaptureDimensions(profiledEvent);

        // Step 6: Select Job Template
        const finalEvent = selectJobTemplate(frameEvent);

        console.log(`RESPONSE:: ${JSON.stringify(finalEvent, null, 2)}`);
        return finalEvent;

    } catch (err) {
        await error.handler(event, err);
        throw err;
    }
};

// Function to fetch event data from DynamoDB
async function fetchEventData(dynamo, event) {
    const params = {
        TableName: process.env.DynamoDBTable,
        Key: {
            guid: event.guid
        }
    };

    const data = await dynamo.get(params);

    // Return a new object combining event and data.Item
    return { ...event, ...data.Item };
}

// Function to parse media info
function parseMediaInfo(event) {
    const mediaInfo = JSON.parse(event.srcMediainfo);
    const srcHeight = mediaInfo.video[0].height;
    const srcWidth = mediaInfo.video[0].width;

    return {
        ...event,
        srcHeight,
        srcWidth
    };
}

// Function to determine video orientation
function determineOrientation(event) {
    const orientation = event.srcWidth >= event.srcHeight ? 'landscape' : 'portrait';
    return {
        ...event,
        orientation
    };
}

// Function to select encoding profile
function selectEncodingProfile(event) {
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

    let closestProfile = null;
    let smallestDifference = Number.MAX_VALUE;

    profiles.forEach(profile => {
        let difference;
        if (event.orientation === 'landscape') {
            difference = Math.abs(event.srcWidth - profile.landscape.width);
            if (difference < smallestDifference) {
                smallestDifference = difference;
                closestProfile = profile.landscape;
            }
        } else {
            difference = Math.abs(event.srcHeight - profile.portrait.height);
            if (difference < smallestDifference) {
                smallestDifference = difference;
                closestProfile = profile.portrait;
            }
        }
    });

    return {
        ...event,
        encodingProfile: closestProfile
    };
}

// Function to set frame capture dimensions
function setFrameCaptureDimensions(event) {
    if (event.frameCapture) {
        return {
            ...event,
            frameCaptureHeight: event.encodingProfile.height,
            frameCaptureWidth: event.encodingProfile.width
        };
    }
    return event;
}

// Function to select job template
function selectJobTemplate(event) {
    if (!event.jobTemplate) {
        const jobTemplateKey = `jobTemplate_${event.encodingProfile.templateSuffix}`;
        const jobTemplate = event[jobTemplateKey];
        console.log(`Chosen template:: ${jobTemplate}`);
        return {
            ...event,
            jobTemplate,
            isCustomTemplate: false
        };
    } else {
        return {
            ...event,
            isCustomTemplate: true
        };
    }
}

// Export functions for testing
module.exports = {
    handler: exports.handler,
    fetchEventData,
    parseMediaInfo,
    determineOrientation,
    selectEncodingProfile,
    setFrameCaptureDimensions,
    selectJobTemplate
};
