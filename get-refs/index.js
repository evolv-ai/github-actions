const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
	try {
		const context = github.context;
		const token = core.getInput('token');
		const ref = core.getInput('ref')

		const client = github.getOctokit(token).rest;

		const refs = await client.git.listMatchingRefs({
			...context.repo,
			ref
		});

		core.setOutput("refs", refs.data);
	} catch (error) {
		core.error(error)
		core.setFailed(error.message);
	}
}

run();
