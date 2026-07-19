import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      region: this.config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404 || error.name === 'NotFound') {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } else {
        throw error;
      }
    }
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
  }

  async downloadFile(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}
