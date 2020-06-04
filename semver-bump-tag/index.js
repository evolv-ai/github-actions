const core = require('@actions/core');
const github = require('@actions/github');

const MAJOR = 'major';
const MINOR = 'minor';
const PATCH = 'patch';
const SEMVER_VERSIONS = [MAJOR, MINOR, PATCH];

function generateNewTag(semvers, bump, prefix, suffix) {
	let maxNum = 0;
	let maxSemver = null;
	semvers.map(semver => {     
			if (semver[bump] >= maxNum) maxSemver = semver;    
	});

	maxSemver[bump] = maxSemver[bump] + 1;
	const newTag = `${prefix}${maxSemver.major}.${maxSemver.minor}.${maxSemver.patch}${suffix}`;

	return newTag;
}

async function run() {
	try {
		const context = github.context;
		const token = core.getInput('token');
		const bump = core.getInput('bump');
		const prefix = core.getInput('prefix');
		const suffix = core.getInput('suffix');
		const major = core.getInput('major')
		const minor = core.getInput('minor')

		if (SEMVER_VERSIONS.indexOf(bump) === -1) {
			throw Error('`bump` input must be either `major`, `minor`, or `patch`.');
		}
		
		const client = new github.GitHub(token);

		let ref = `tags/${prefix}`;
		if (major) {
			ref += `${major}.`
		} 
		if (minor) {
			ref += `${minor}.`
		}

		const tags = (await client.git.listMatchingRefs({
			...context.repo,
			ref 
		})).data;

		console.log(tags);

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

		let newTag = `${prefix}${major || 1}.${minor || 0}.0${suffix}`
		if (semvers.length > 0) {
			newTag = generateNewTag(semvers, bump, prefix, suffix);
		}

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
