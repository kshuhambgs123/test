import S3 from "aws-sdk/clients/s3";

const config = {
  endpoint: process.env.S3BUCKETENDPOINT,
  accessKeyId: process.env.AccessKey,
  secretAccessKey: process.env.SecretKey,
  s3ForcePathStyle: true, // Required for Linode Object Storage
  signatureVersion: "v4",
};

const s3 = new S3(config);

export default s3;
