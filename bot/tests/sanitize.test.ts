import { sanitizeFilename, isSafeFilename, sanitizeWebdavPath, parseSelection } from "../src/utils/sanitize";

describe("sanitizeFilename", () => {
  it("strips directory components", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("removes traversal sequences", () => {
    expect(sanitizeFilename("evil..name.txt")).toBe("evilname.txt");
  });

  it("rejects empty result", () => {
    expect(() => sanitizeFilename("../../")).toThrow();
  });

  it("keeps a normal filename intact", () => {
    expect(sanitizeFilename("Project_Report.pdf")).toBe("Project_Report.pdf");
  });
});

describe("isSafeFilename", () => {
  it("accepts normal names", () => {
    expect(isSafeFilename("Resume (final).pdf")).toBe(true);
  });

  it("rejects traversal", () => {
    expect(isSafeFilename("../secret.txt")).toBe(false);
  });

  it("rejects shell metacharacters", () => {
    expect(isSafeFilename("file; rm -rf /")).toBe(false);
  });
});

describe("sanitizeWebdavPath", () => {
  it("drops .. segments", () => {
    expect(sanitizeWebdavPath("SecureCloud/../../etc/passwd")).toBe("SecureCloud/etc/passwd");
  });

  it("preserves a normal nested path", () => {
    expect(sanitizeWebdavPath("SecureCloud/Project_Report.pdf")).toBe(
      "SecureCloud/Project_Report.pdf"
    );
  });
});

describe("parseSelection", () => {
  it("parses a valid numeric selection", () => {
    expect(parseSelection("3", 5)).toBe(3);
  });

  it("rejects out-of-range selection", () => {
    expect(parseSelection("9", 5)).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseSelection("delete everything", 5)).toBeNull();
  });

  it("rejects zero and negative-looking input", () => {
    expect(parseSelection("0", 5)).toBeNull();
  });
});
