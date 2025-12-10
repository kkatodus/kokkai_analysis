import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
};

function getConfig(): CognitoConfig {
  const region = process.env.COGNITO_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!region) {
    throw new Error("COGNITO_REGION is not set");
  }

  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID is not set");
  }

  if (!clientId) {
    throw new Error("COGNITO_CLIENT_ID is not set");
  }

  return { region, userPoolId, clientId };
}

const { region } = getConfig();

export const cognitoClient = new CognitoIdentityProviderClient({ region });

export function getCognitoConfig(): CognitoConfig {
  return getConfig();
}
