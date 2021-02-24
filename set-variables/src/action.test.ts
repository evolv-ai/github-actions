import * as core from '@actions/core';
import * as github from '@actions/github';
import * as process from 'process';

import { run } from './action';


describe('Set Variables Action', () => {
	let outputs: [string, string][] = [];
	let createRefSpy: jest.Mock;

	beforeEach(() => {
		process.env['GITHUB_REPOSITORY'] = 'SentientTechnologies/dummy';

		github.context.ref = 'v1.0.0';
		github.context.sha = '1e6c5ad1fcc704bf034a8ea9fd58e6784dea9fa1';

		process.env['INPUT_TOKEN'] = 'token';
		process.env['INPUT_SLACK_WEBHOOK'] = 'https://slack.com/dev';
		process.env['INPUT_STAGING_SLACK_WEBHOOK'] = 'https://slack.com/staging';
		process.env['INPUT_PROD_SLACK_WEBHOOK'] = 'https://slack.com/prod';


		createRefSpy = jest.fn();

		jest.spyOn(core, 'setOutput').mockImplementation((name: string, value: string) => {
			outputs.push([name, value]);
		});

		jest.spyOn(github, 'GitHub').mockImplementation(() => {
			return {
				git: {
					createRef: createRefSpy
				}
			} as any;
		});
	});

	afterEach(() => {
		outputs = [];
	});

	describe('when NODE_ENV = "prod"', () => {
		beforeEach(() => {
			github.context.payload = {
				owner: 'SentientTechnologies',
				repo: 'dummy',
				ref: 'v1.0.0',
				sha: '1e6c5ad1fcc704bf034a8ea9fd58e6784dea9fa1',
				environment: 'prod'
			}
		});

		it('should have expected outputs', async () => {
			// Act
			await run();

			// Assert
			expect(outputs).toEqual([
				['SEM_VER', '1.0.0'],
				['NODE_ENV', 'production'],
				['SLACK_CHANNEL', 'deploy-prod'],
				['CREATE_RELEASE', 'true'],
				['PRERELEASE', 'false'],
				['SLACK_WEBHOOK', 'https://slack.com/prod'],
			]);
		});
	});

	describe('when NODE_ENV = "staging"', () => {
		beforeEach(() => {
			github.context.payload = {
				owner: 'SentientTechnologies',
				repo: 'dummy',
				ref: 'v1.0.0',
				sha: '1e6c5ad1fcc704bf034a8ea9fd58e6784dea9fa1',
				environment: 'staging'
			}
		});

		it('should have expected outputs', async () => {
			// Act
			await run();

			// Assert
			expect(outputs).toEqual([
				['SEM_VER', '1.0.0'],
				['NODE_ENV', 'staging'],
				['SLACK_CHANNEL', 'deploy-staging'],
				['CREATE_RELEASE', 'true'],
				['PRERELEASE', 'true'],
				['SEM_VER', '1.0.0-alpha-1e6c5ad'], // Outputted twice
				['SLACK_WEBHOOK', 'https://slack.com/staging']
			]);

			expect(createRefSpy).toHaveBeenCalledWith({
				owner: 'SentientTechnologies',
				repo: 'dummy',
				ref: 'refs/tags/v1.0.0-alpha-1e6c5ad',
				sha: '1e6c5ad1fcc704bf034a8ea9fd58e6784dea9fa1'
			});
		});
	});

	describe('when NODE_ENV = "dev"', () => {
		beforeEach(() => {
			github.context.payload = {
				owner: 'SentientTechnologies',
				repo: 'dummy',
				ref: 'v1.0.0',
				sha: '1e6c5ad1fcc704bf034a8ea9fd58e6784dea9fa1',
				environment: 'dev'
			}
		});

		it('should have expected outputs', async () => {
			// Act
			await run();

			// Assert
			expect(outputs).toEqual([
				['SEM_VER', '1.0.0'],
				['NODE_ENV', 'development'],
				['SLACK_CHANNEL', 'deploy'],
				['CREATE_RELEASE', 'false'],
				['SLACK_WEBHOOK', 'https://slack.com/dev'],
			]);
		});
	});
});

