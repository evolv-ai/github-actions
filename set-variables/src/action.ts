import * as core from '@actions/core';
import * as github from '@actions/github';
import { EventPayloads } from '@octokit/webhooks';

export async function run(): Promise<void> {
	try {
		const { context } = github;
		const payload = context.payload as EventPayloads.WebhookPayloadDeploymentDeployment;

		const token = core.getInput('token');
		const client = new github.GitHub(token);

		const releaseRef = payload.ref;
		const semVer = `${releaseRef}`.replace(/^v/, '');

		core.setOutput('SEM_VER', semVer);

		if (payload.environment === 'prod') {
			core.setOutput('NODE_ENV', 'production');
			core.setOutput('SLACK_CHANNEL', 'deploy-prod');
			core.setOutput('CREATE_RELEASE', 'true');
			core.setOutput('PRERELEASE', 'false');
			core.setOutput('SLACK_WEBHOOK', core.getInput('PROD_SLACK_WEBHOOK'));
		} else if (payload.environment === 'staging') {
			const semVerAlpha = `${semVer}-alpha-${payload.sha.slice(0, 7)}`;

			core.setOutput('NODE_ENV', 'staging');
			core.setOutput('SLACK_CHANNEL', 'deploy-staging');
			core.setOutput('CREATE_RELEASE', 'true');
			core.setOutput('PRERELEASE', 'true');
			core.setOutput('SEM_VER', semVerAlpha);
			core.setOutput('SLACK_WEBHOOK', core.getInput('STAGING_SLACK_WEBHOOK'));

			await client.git.createRef({
				owner: context.repo.owner,
				repo: context.repo.repo,
				ref: `refs/tags/v${semVerAlpha}`,
				sha: context.sha
			});
		} else {
			core.setOutput('NODE_ENV', 'development');
			core.setOutput('SLACK_CHANNEL', 'deploy');
			core.setOutput('CREATE_RELEASE', 'false');
			core.setOutput('SLACK_WEBHOOK', core.getInput('SLACK_WEBHOOK'));
		}
	} catch (error) {
		core.error(error);
		core.setFailed(error.message);
	}
}
