import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';
import { v4 } from 'uuid';
import * as yup from 'yup';

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'ParksTable';
const headers = {
  'content-type': 'application/json',
};

const schema = yup.object().shape({
  name: yup.string().required(),
  location: yup.string().required(),
  description: yup.string().required(),
});

export const createPark = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event?.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const park = {
      ...reqBody,
      parkId: v4(),
    };

    await docClient
      .put({
        TableName: tableName,
        Item: park,
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(park),
    };
  } catch (error) {
    return handleError(error);
  }
};

class HttpError extends Error {
  constructor(
    public statusCody: number,
    body: Record<string, unknown> = {}
  ) {
    super(JSON.stringify(body));
  }
}

const handleError = (error: unknown) => {
  if (error instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: error.errors,
      }),
    };
  }

  if (error instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: `Invalid request body format: ${error.message}`,
      }),
    };
  }

  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCody,
      headers,
      body: error.message,
    };
  }

  throw error;
};

const fetchParkById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        parkId: id,
      },
    })
    .promise();

  if (!output.Item) {
    throw new HttpError(404, { error: 'Park not found' });
  }

  return output.Item;
};

export const getPark = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const park = await fetchParkById(event?.pathParameters?.id as string);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(park),
    };
  } catch (error) {
    return handleError(error);
  }
};
