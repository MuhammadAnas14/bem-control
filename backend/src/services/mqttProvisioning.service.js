const path = require('path');
const fs = require('fs/promises');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Lives outside backend/ because it's shared, mounted read-only into the
// Mosquitto container (see docker-compose.yml + mosquitto/config/mosquitto.conf).
const CERTS_DIR = path.resolve(__dirname, '../../../mosquitto/certs');
const PASSWORDS_FILE = path.join(CERTS_DIR, 'passwords.txt');
const ACL_FILE = path.join(CERTS_DIR, 'acl.conf');

/**
 * Syncs a newly-provisioned device's credentials into the broker's auth
 * files, then asks Mosquitto to reload them (SIGHUP reloads password_file
 * and acl_file without dropping existing connections).
 *
 * In a production deployment this would instead call the broker's dynamic
 * security plugin (EMQX/Mosquitto dynsec) over its management API rather
 * than shelling out to file-based tooling - file-based auth is a pragmatic
 * choice for a self-hosted dev/demo broker, not what you'd run at scale.
 */
async function addDeviceCredential(mqttUsername, plaintextPassword) {
  await ensureFileExists(PASSWORDS_FILE);
  await runMosquittoPasswd(['-b', PASSWORDS_FILE, mqttUsername, plaintextPassword]);
  await reloadBroker();
}

async function revokeDeviceCredential(mqttUsername) {
  await ensureFileExists(PASSWORDS_FILE);
  // -D deletes a username's entry from the password file
  await runMosquittoPasswd(['-D', PASSWORDS_FILE, mqttUsername]).catch(() => {
    /* already absent - nothing to revoke */
  });
  await reloadBroker();
}

async function appendDeviceAcl(mqttUsername, deviceKey) {
  await ensureFileExists(ACL_FILE);
  const block = [
    '',
    `user ${mqttUsername}`,
    `topic write orgs/+/devices/${deviceKey}/telemetry`,
    `topic read orgs/+/devices/${deviceKey}/commands`,
    `topic read orgs/+/devices/${deviceKey}/config`,
    '',
  ].join('\n');
  await fs.appendFile(ACL_FILE, block);
  await reloadBroker();
}

async function runMosquittoPasswd(args) {
  const quoted = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ');
  try {
    await execAsync(`mosquitto_passwd ${quoted}`);
  } catch (localErr) {
    // Fall back to running it inside the broker's own container image, in
    // case the mosquitto-clients CLI isn't installed on the host.
    await execAsync(
      `docker run --rm -v "${CERTS_DIR}:/certs" eclipse-mosquitto:2.0 mosquitto_passwd ${args
        .map((a) => (a === PASSWORDS_FILE ? '/certs/passwords.txt' : `'${a}'`))
        .join(' ')}`
    ).catch(() => {
      throw new Error(
        `Could not run mosquitto_passwd locally or via docker: ${localErr.message}`
      );
    });
  }
}

async function reloadBroker() {
  // Best-effort: if the broker isn't running as a local docker container
  // (e.g. it's a remote managed broker), this is a no-op the caller should
  // ignore - the files are still updated on disk for the next restart.
  await execAsync('docker kill --signal=HUP bem-mosquitto').catch(() => {
    console.warn(
      '[mqttProvisioning] Could not signal bem-mosquitto to reload auth files. ' +
        'If the broker is running elsewhere, restart it manually to pick up the change.'
    );
  });
}

async function ensureFileExists(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '', { flag: 'a' });
}

module.exports = { addDeviceCredential, revokeDeviceCredential, appendDeviceAcl };
