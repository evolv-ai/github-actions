const core = require('@actions/core');
const github = require('@actions/github');
const cherry = require('github-cherry-pick');
const axios = require('axios');

HOTFIX_REGEX = 'hotfix-(v\\d+.\\d+)-?(v\\d+.\\d+)?'

function postSlackMessage(webhook, data) {
	if (webhook) {
		axios.post(
			webhook,
			data
		).catch(error => {
			console.log(error);
		});
	}
}

function postStartMessage(webhook, context, pull, hotfixes) {
	const userName = getSlackUserName(pull);
	postSlackMessage(webhook, {
		"blocks": [
			{
				"type": "divider"
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `@${userName} :cherries: Starting cherry-pick process for pull <${pull.html_url}|#${pull.number}> (\`${pull.head.ref} -> ${pull.base.ref}\`) to version(s) \`${hotfixes}\` in ${context.repo.owner}/${context.repo.repo}.`
				}
			}
		]
	});
}

function postSuccessMessage(webhook, context, pull, targetVersion, newTag, previousTag) {
	const userName = getSlackUserName(pull);
	const tag = newTag.replace('refs/tags/', '')
	postSlackMessage(webhook, {
		"blocks": [
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `@${userName} :rocket: successfully cherry-picked commits from pull <${pull.html_url}|#${pull.number}> (\`${pull.head.ref} -> ${pull.base.ref}\`) to version \`${targetVersion}\` in ${context.repo.owner}/${context.repo.repo}.`
				}
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `The latest tag for \`${targetVersion}\` has been created at <https://github.com/${context.repo.owner}/${context.repo.repo}/tree/${tag}|${tag}>`
				}
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `You can see a diff between the last tag <https://github.com/${context.repo.owner}/${context.repo.repo}/compare/${previousTag}...${tag}|here>.`
				}
			}
		]
	});
}

function postFailMessage(webhook, context, pull, commits, targetVersion) {
	const userName = getSlackUserName(pull);
	postSlackMessage(webhook, {
		"blocks": [
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `@${userName} :boom: there was an issue cherry-picking commits from pull <${pull.html_url}|#${pull.number}> (\`${pull.head.ref} -> ${pull.base.ref}\`) to version \`${targetVersion}\` in ${context.repo.owner}/${context.repo.repo}.`
				}
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `You must perform the cherry-picking process manually by following the steps below while in the ${context.repo.owner}/${context.repo.repo} repo:`
				}
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": `\`\`\`git fetch --tags\ngit checkout -b cherry-pick/pull-${pull.number} ${targetVersion}.<latest patch version>\ngit cherry-pick ${commits.length === 1 ? commits[0] : `${commits[0]}^...${commits[commits.length - 1]}`}\ngit tag ${targetVersion}.<latest patch version + 1>\ngit push --tags\`\`\``
				}
			}
		]
	});
}

function getSlackUserName(pull) {
	return 'here';
}

async function getMatchingRefs(client, context, ref) {
	const response = await client.git.listMatchingRefs({
		...context.repo,
		ref
	});
	return response.data;
}

async function getRef(client, context, ref) {
	const response = await client.git.getRef({
		...context.repo,
		ref
	});
	return response.data;
}

function deleteBranches(client, context, branches) {
	branches.forEach(branch => {
		client.git.deleteRef({
			...context.repo,
			ref: branch.ref.replace('refs/', '')
		});
	});
}

async function createRef(client, context, ref, sha) {
	const response = await client.git.createRef({
		...context.repo,
		ref,
		sha
	});
	return response.data;
}

async function getLatestSemvers(client, context, hotfixes) {
	const latestSemvers = [];
	for (let i = 0; i < hotfixes.length; i++) {
		const tags = await getMatchingRefs(client, context, `tags/${hotfixes[i]}`);

		let maxNum = 0;
		let maxSemver = null;

		const regex = new RegExp(`^refs\\/tags\\/v(?<major>\\d+).(?<minor>\\d+).(?<patch>\\d+)$`);

		tags
			.map(tag => regex.exec(tag.ref))
			.filter(re => re)
			.map(re => {
				const groups = re.groups;
				groups.major = parseInt(groups.major);
				groups.minor = parseInt(groups.minor);
				groups.patch = parseInt(groups.patch);
				return groups;
			})
			.map(semver => {
				if (semver.patch >= maxNum) {
					maxSemver = semver;
					maxNum = semver.patch;
				};
			});

		latestSemvers.push(maxSemver);
	}

	return latestSemvers;
}

async function getPull(client, context, pullNumber) {
	const response = await client.pulls.get({
		...context.repo,
		pull_number: pullNumber
	});
	return response.data;
}

async function getPullComments(client, context, pullNumber) {
	const response = await client.pulls.listComments({
		...context.repo,
		pull_number: pullNumber
	})
	return response.data;
}

async function getIssueComments(client, context, pullNumber) {
	const response = await client.issues.listComments({
		...context.repo,
		issue_number: pullNumber
	})
	return response.data;
}

async function getPullCommitShas(client, context, pullNumber) {
	const pullCommits = (await client.pulls.listCommits({
		...context.repo,
		pull_number: pullNumber
	})).data;
	const commits = pullCommits.map(commit => commit.sha);
	return commits;
}

function getHotfixes(pull, comments) {
	const regex = new RegExp(HOTFIX_REGEX);

	const match = pull.head.ref.match(regex);
	if (match) {
		return [match[1], match[2]].filter(group => group);
	}

	const matches = comments
	 .map(comment => comment.body.match(regex))
	 .filter(match => match);

	if (matches.length > 0) {
		return [matches[0][1], matches[0][2]].filter(group => group);
	}

	return []
}

async function cherryPickCommits(octokit, context, head, commits) {
	const response = await cherry.cherryPickCommits({
		...context.repo,
		octokit,
		head,
		commits
	});
	return response;
}

async function run() {
	try {
		const context = github.context;
		const token = core.getInput('token');
		const pullNumber = parseInt(core.getInput('pull_number'));
		const slackWebhook = core.getInput('slack_webhook');

		const client = github.getOctokit(token).rest;

		console.log(`Repo: ${context.repo.owner}/${context.repo.repo}`);
		console.log('Pull request number:', pullNumber);
		console.log('Beginning cherry pick routine...');

		const pull = await getPull(client, context, pullNumber);
		const reviewComments = await getPullComments(client, context, pull.number);
		const issueComments = await getIssueComments(client, context, pull.number);
		const comments = [...reviewComments, ...issueComments];

		const hotfixes = getHotfixes(pull, comments)
		if (hotfixes.length === 0) {
			console.log('Bailing, no versions to hotfix.')
			return;
		}

		const commits = await getPullCommitShas(client, context, pullNumber);
		if (commits.length > 99) {
			throw Error('Bailing, only 99 or less commits are allowed to be cherry picked via this action.');
		}

		postStartMessage(slackWebhook, context, pull, hotfixes);
		console.log('Hotfixing versions: ', hotfixes);

		console.log(`Found ${commits.length} commit for cherry picking.`);
		console.log(JSON.stringify(commits));

		const latestSemvers = await getLatestSemvers(client, context, hotfixes);

		const cherryPicks = [];
		for (let i = 0; i < latestSemvers.length; i++) {
			const semver = latestSemvers[i];
			if (!semver) {
				continue;
			}

			const branchName = `cherry-pick-${Date.now()}`;
			const branchRef = `heads/${branchName}`;
			const tagToUpdate = `v${semver.major}.${semver.minor}.${semver.patch}`;

			const response = {
				success: false,
				newTag: null,
				tagToUpdate
			}

			try {
				const tagRef = await getRef(client, context, `tags/${tagToUpdate}`);

				console.log('Cherry picking commits on top of:', tagRef.ref);
				const newBranch = await createRef(client, context, `refs/${branchRef}`, tagRef.object.sha);
				const newHeadSha = await cherryPickCommits(client, context, branchName, commits);
				const newTag = await createRef(client, context, `refs/tags/v${semver.major}.${semver.minor}.${semver.patch + 1}`, newHeadSha);
				console.log('Successfully cherry picked commits and created tag:', newTag.ref);

				response.success = true;
				response.newTag = newTag;

				postSuccessMessage(slackWebhook, context, pull, `v${semver.major}.${semver.minor}`, newTag.ref, `v${semver.major}.${semver.minor}.${semver.patch}`);
			} catch (error) {
				postFailMessage(slackWebhook, context, pull, commits, `v${semver.major}.${semver.minor}`);
				console.log('An error occurred while trying to cherry pick.');
				console.log(error);
			} finally {
				const branchesToDelete = await getMatchingRefs(client, context, branchRef);
				deleteBranches(client, context, branchesToDelete);
			}

			cherryPicks.push(response);
		}

		console.log(JSON.stringify(cherryPicks));
		core.setOutput('cherry_picks', JSON.stringify(cherryPicks));
	} catch (error) {
		core.error(error);
		core.setFailed(error.message);
	}
}

run();
