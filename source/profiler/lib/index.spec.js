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

const expect = require('chai').expect;
const path = require('path');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = require('../index.js');

describe('#PROFILER::', () => {
    process.env.ErrorHandler = 'error_handler';

    const _event = {
        guid: '12345678'
    };

    const _tmpl_event = {
        guid: '12345678',
        jobTemplate: 'customTemplate'
    };

    // Test data for a landscape video
    const data_landscape = {
        Item: {
            guid: '12345678',
            srcMediainfo: '{ "video": [{ "height": 720, "width": 1280 }] }',
            jobTemplate_2160p_landscape: 'tmpl1_landscape',
            jobTemplate_1080p_landscape: 'tmpl2_landscape',
            jobTemplate_720p_landscape: 'tmpl3_landscape',
            jobTemplate_2160p_portrait: 'tmpl1_portrait',
            jobTemplate_1080p_portrait: 'tmpl2_portrait',
            jobTemplate_720p_portrait: 'tmpl3_portrait',
            frameCapture: true
        }
    };

    // Test data for a portrait video
    const data_portrait = {
        Item: {
            guid: '12345678',
            srcMediainfo: '{ "video": [{ "height": 1280, "width": 720 }] }',
            jobTemplate_2160p_landscape: 'tmpl1_landscape',
            jobTemplate_1080p_landscape: 'tmpl2_landscape',
            jobTemplate_720p_landscape: 'tmpl3_landscape',
            jobTemplate_2160p_portrait: 'tmpl1_portrait',
            jobTemplate_1080p_portrait: 'tmpl2_portrait',
            jobTemplate_720p_portrait: 'tmpl3_portrait',
            frameCapture: true
        }
    };

    const dynamoDBDocumentClientMock = mockClient(DynamoDBDocumentClient);
    const lambdaClientMock = mockClient(LambdaClient);

    afterEach(() => dynamoDBDocumentClientMock.reset());

    it('should return "SUCCESS" on profile set for landscape video', async () => {
        dynamoDBDocumentClientMock.on(GetCommand).resolves(data_landscape);

        const response = await lambda.handler(_event);
        expect(response.jobTemplate).to.equal('tmpl3_landscape');
        expect(response.frameCaptureHeight).to.equal(720);
        expect(response.frameCaptureWidth).to.equal(1280);
        expect(response.isCustomTemplate).to.be.false;
        expect(response.orientation).to.equal('landscape');
    });

    it('should return "SUCCESS" on profile set for portrait video', async () => {
        dynamoDBDocumentClientMock.on(GetCommand).resolves(data_portrait);

        const response = await lambda.handler(_event);
        expect(response.jobTemplate).to.equal('tmpl3_portrait');
        expect(response.frameCaptureHeight).to.equal(1280);
        expect(response.frameCaptureWidth).to.equal(720);
        expect(response.isCustomTemplate).to.be.false;
        expect(response.orientation).to.equal('portrait');
    });

    it('should return "SUCCESS" using a custom template', async () => {
        dynamoDBDocumentClientMock.on(GetCommand).resolves(data_landscape);

        const response = await lambda.handler(_tmpl_event);
        expect(response.jobTemplate).to.equal('customTemplate');
        expect(response.frameCaptureHeight).to.equal(720);
        expect(response.frameCaptureWidth).to.equal(1280);
        expect(response.isCustomTemplate).to.be.true;
        expect(response.orientation).to.equal('landscape');
    });

    it('should return "DB ERROR" when db get fails', async () => {
        dynamoDBDocumentClientMock.on(GetCommand).rejects('DB ERROR');
        lambdaClientMock.on(InvokeCommand).resolves();

        await lambda.handler(_event).catch(err => {
            expect(err.toString()).to.equal('Error: DB ERROR');
        });
    });
});
