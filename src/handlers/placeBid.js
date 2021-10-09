import AWS from 'aws-sdk';
import validator from '@middy/validator';
import createError from 'http-errors'; 
import { getAuctionById } from './getAuction';
import commonMiddleware from '../lib/commonMiddleware';
import placeBidSchema from '../lib/schemas/placeBidSchema';

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;
  const { amount } = event.body;

  const auction = await getAuctionById(id);

  if (email === auction.seller) {
    throw new createError.Forbidden(`You cannot bid on your own auctions!`);
  }

  if (email === auction.highestBid.bidder) {
    throw new createError.Forbidden(`Your are already the highest bidder.`);
  }

  if (auction.status !== 'OPEN') {
    throw new createError.Forbidden(`You cannot bid on closed auctions!`);
  }

  if (amount <= auction.highestBid.amount) {
    throw new createError.NotFound(`Your bid must be higher than "${auction.highestBid.amount}!"`);
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    ExpressionAttributeValues: {
      ':amount': amount,
      ':bidder': email,
    },
    ReturnValues: 'ALL_NEW',
  };

  let updateAuction;

  try {
    const result = await dynamodb.update(params).promise();
    updateAuction = result.Attributes;
  } catch(error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  

  return {
    statusCode: 200,
    body: JSON.stringify(updateAuction),
  };
}

export const handler = commonMiddleware(placeBid).use(
  validator({
    inputSchema: placeBidSchema,
    ajvOptions: {
      useDefaults: true,
      strict: false,
    },
  })
);


