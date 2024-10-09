const github = require('@actions/github');
const axios = require('axios');
const core = require('@actions/core');

const colors = {
  success: '#2cbe4e',
  failure: '#ff0000',
  other: '#ffc107'
};

const events = {
  pull_request: 'pull_request',
  push: 'push',
  workflow_dispatch: 'workflow_dispatch'
};

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const name = core.getInput('name', { required: true });
    const url = core.getInput('url', { required: true });

    const validationId = core.getInput('validationId', { required: true });
    const validationStatus = core.getInput('validationStatus', { required: true });
    const validationUrl = core.getInput('validationUrl', { required: true });
    const validationDetails = core.getInput('validationDetails', { required: true });

    const ok = await sendNotification(name, url, validationId, validationStatus, validationUrl, validationDetails);
    if (!ok) {
      core.setFailed('error sending notification to google chat');
    } else {
      core.debug(`Sent notification: ${name}`);
    }
  } catch (e) {
    core.setFailed(`error sending notification to google chat: ${e}`);
  }
}

async function sendNotification(name, url, validationId, validationStatus, validationUrl, validationDetails) {
  const { owner, repo } = github.context.repo;
  const { eventName, sha, ref, actor, workflow } = github.context;
  const { number } = github.context.issue;

  const card = createCard({
    name,
    owner,
    repo,
    eventName,
    ref,
    actor,
    workflow,
    sha,
    number,
    validationId,
    validationStatus,
    validationUrl,
    validationDetails
  });
  const body = createBody(name, card);

  try {
    const response = await axios.post(url, body);
    core.debug(`request success with status: ${response.status}`);
    return true;
  } catch (e) {
    core.debug(`request failed with error, body: ${JSON.stringify(body)}, response:${JSON.stringify(e.response?.data || '')}`);
    return false;
  }
}

function createCard({ name, owner, repo, eventName, ref, actor, workflow, sha, number, validationId, validationStatus, validationUrl, validationDetails }) {
  const statusLower = validationStatus.toLowerCase();
  let statusColor;
  const statusName = validationStatus.substring(0, 1).toUpperCase() + validationStatus.substring(1);
  let statusType = statusLower;
  if (statusLower === 'success') {
    statusColor = colors.success;
  } else if (statusLower === 'failure') {
    statusColor = colors.failure;
  } else {
    // if (statusLower === 'cancelled') {
    statusColor = colors.other;
    statusType = 'cancelled';
  }

  const eventType = events[(eventName || '').toLowerCase()] || events.push;
  let eventNameFmt;
  if (eventType === events.pull_request) {
    eventNameFmt = 'Pull Request';
  } else if (eventType === events.push) {
    eventNameFmt = 'Push';
  } else {
    eventNameFmt = 'Workflow Dispatch';
  }

  const eventPath = eventType === events.pull_request ? `/pull/${number}` : `/commit/${sha}`;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const eventUrl = `${repoUrl}${eventPath}`;
  const checksUrl = `${repoUrl}${eventPath}/checks`;
  const showNameWidget = name.length >= 45; // google chat truncates title header if too long
  const nameWidgets = [];
  if (showNameWidget) {
    nameWidgets.push({
      decoratedText: {
        topLabel: 'Name',
        text: name,
        wrapText: true
      }
    });
  }
  return {
    header: {
      title: name,
      subtitle: `${owner}/${repo}`,
      imageUrl: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
      imageType: 'CIRCLE'
    },
    sections: [
      {
        widgets: [
          {
            decoratedText: {
              icon: { iconUrl: `https://raw.githubusercontent.com/ciro-maciel/google-chat-github-action/main/assets/status_${statusType}.png` },
              topLabel: 'Status',
              text: `<font color="${statusColor}">${statusName}</font>`,
              button: { text: 'Open Job', onClick: { openLink: { url: checksUrl } } }
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: `https://raw.githubusercontent.com/ciro-maciel/google-chat-github-action/main/assets/event_${eventType}.png` },
              topLabel: 'Event',
              text: eventNameFmt,
              button: { text: 'Open Event', onClick: { openLink: { url: eventUrl } } }
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ciro-maciel/google-chat-github-action/main/assets/ref.png' },
              topLabel: 'Ref',
              text: ref
            }
          },
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ciro-maciel/google-chat-github-action/main/assets/actor.png' },
              topLabel: 'Actor',
              text: actor
            }
          },
          ...nameWidgets
        ]
      },
      {
        header: `Code Standardization`,
        collapsible: false,
        widgets: [
          { textParagraph: { text: 'is coming...🫥🤓' } }
        ]
      },
      // https://developers.google.com/workspace/chat/api/reference/rest/v1/cards?hl=pt-br
      // https://addons.gsuite.google.com/uikit/builder?hl=pt-br
      // https://developers.google.com/workspace/chat/format-messages?hl=pt-br#format-texts
      {
        header: `Summary`,
        collapsible: true,
        widgets: [
          {
            decoratedText: {
              icon: { iconUrl: 'https://raw.githubusercontent.com/ciro-maciel/google-chat-github-action/main/assets/summary.png' },
              topLabel: 'Name',
              text: validationId,
              button: {
                text: 'Open Details',
                onClick: {
                  openLink: {
                    url: validationUrl
                  }
                }
              }
            }
          },
          { textParagraph: { text: validationDetails } }
        ]
      }
    ]
  };
}

function createBody(name, card) {
  return { text: '', cardsV2: [{ cardId: name, card: { name, ...card } }] };
}

// exports
module.exports = { run, colors };
