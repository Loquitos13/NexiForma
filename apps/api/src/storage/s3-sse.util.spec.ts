import { resolveS3SsePutOptions } from "./s3-sse.util";

describe("resolveS3SsePutOptions", () => {
  it("usa AES256 por defeito", () => {
    expect(resolveS3SsePutOptions({})).toEqual({ ServerSideEncryption: "AES256" });
  });

  it("aceita AES256 explícito", () => {
    expect(resolveS3SsePutOptions({ S3_SSE_ALGORITHM: "AES256" })).toEqual({
      ServerSideEncryption: "AES256",
    });
  });

  it("exige KMS key para aws:kms", () => {
    expect(() => resolveS3SsePutOptions({ S3_SSE_ALGORITHM: "aws:kms" })).toThrow(/S3_KMS_KEY_ID/);
  });

  it("devolve aws:kms com key id", () => {
    expect(
      resolveS3SsePutOptions({
        S3_SSE_ALGORITHM: "aws:kms",
        S3_KMS_KEY_ID: "arn:aws:kms:eu-west-1:123:key/abc",
      }),
    ).toEqual({
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "arn:aws:kms:eu-west-1:123:key/abc",
    });
  });
});
