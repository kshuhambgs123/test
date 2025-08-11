import s3 from "../db/s3";

export async function uploadToS3(
  bucketName: string,
  FileName: string,
  Body: string,
  type: string,
  ContentType: string
): Promise<any | null> {
  return new Promise<any | null>((resolve, reject) => {
    console.log(bucketName);
    s3.upload(
      {
        Bucket: bucketName,
        Key: FileName,
        Body: Body,
        ACL: type,
        ContentType: ContentType,
      },
      (err, data) => {
        if (err) {
          console.log(err);
          return resolve(null);
        }

        return resolve(data);
      }
    );
  });
}
