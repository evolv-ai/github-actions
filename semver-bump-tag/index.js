const core = require('@actions/core');
const github = require('@actions/github');

const MAJOR = 'major';
const MINOR = 'minor';
const PATCH = 'patch';
const SEMVER_VERSIONS = [MAJOR, MINOR, PATCH];

function generateNewTag(tags, bump, prefix, suffix) {
	const regex = new RegExp(`^refs\\/tags\\/${prefix}(?<major>\\d+).(?<minor>\\d+).(?<patch>\\d+)$`);

	const	semvers = tags
		.map(tag => regex.exec(tag.ref))
		.filter(re => re)
		.map(re => {
			const groups = re.groups;
			groups.major = parseInt(groups.major);
			groups.minor = parseInt(groups.minor);
			groups.patch = parseInt(groups.patch);
			return groups;
		});

	let maxNum = 0;
	let maxSemver = null;
	semvers.map(semver => {     
			if (semver[bump] >= maxNum) maxSemver = semver;    
	});

	if (!maxSemver) {
		return undefined;
	}

	maxSemver[bump] = maxSemver[bump] + 1;
	const newTag = `${prefix}${maxSemver.major}.${maxSemver.minor}.${maxSemver.patch}${suffix}`;

	return newTag;
}

async function run() {
	try {
		const context = github.context;
		const token = core.getInput('token');
		const tags = JSON.parse(core.getInput('tags'));
		const bump = core.getInput('bump');
		const prefix = core.getInput('prefix');
		const suffix = core.getInput('suffix');

		if (SEMVER_VERSIONS.indexOf(bump) === -1) {
			throw Error('`bump` input must be either `major`, `minor`, or `patch`.');
		}

		const newTag = generateNewTag(tags, bump, prefix, suffix);

		if (!newTag) {
			console.log('Could not generate new tag.')
			core.setOutput('tag', '');
			return;
		}
		
		const client = new github.GitHub(token);

		const resp = await client.git.createRef({
			...context.repo,
			sha: context.sha,
			ref: `refs/tags/${newTag}`
		});

		console.log(resp);

		core.setOutput('tag', newTag);
	} catch (error) {
		core.error(error);
		core.setFailed(error.message);
	}
}

run();
