const core = require('@actions/core');
const github = require('@actions/github');


export async function run() {
	try {
		const { context } = github;

		const token = core.getInput('token');
		const { rest: { repos } } = new github.getOctokit(token);
		const { owner, repo } = context.repo;

		const { data } = await repos.listTags({ ...context.repo });

		if (!data || !data[0]) {
			throw new Error(`Error retrieving tags for '${owner}/${repo}'`);
		}

		const [mostRecent] = data;

		console.log(mostRecent);
		console.log(mostRecent.name);

		core.setOutput('mostRecent', mostRecent.name);
	} catch (error) {
		core.error(error);
		core.setFailed(error.message);
	}
}
