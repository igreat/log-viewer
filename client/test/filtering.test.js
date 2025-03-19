import { checkMatch } from '../src/logService';

describe("checkMatch", () => {
    test("should return true when no filters are applied", () => {
        const log = { messages: ["Test log"], level: "info" };
        const filters = [];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return true for a case-insensitive plain text match", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "test", regex: false, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return true for a case-sensitive plain text match", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "Test", regex: false, caseSensitive: true }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return false when case-sensitive match fails due to case difference", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "test", regex: false, caseSensitive: true }];
        expect(checkMatch(log, filters)).toBe(false);
    });

    test("should correctly handle regex filters (case-insensitive)", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "^test", regex: true, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should correctly handle regex filters (case-sensitive match)", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "^Test", regex: true, caseSensitive: true }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return false for regex filters when case-sensitive match fails", () => {
        const log = { message: "Test log" };
        const filters = [{ text: "^test", regex: true, caseSensitive: true }];
        expect(checkMatch(log, filters)).toBe(false);
    });

    test("should match when one of multiple log values satisfies the filter", () => {
        const log = { message: "Test log", level: "warning" };
        const filters = [{ text: "warning", regex: false, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return false when none of multiple filters match any log value", () => {
        const log = { message: "Test log", level: "info" };
        const filters = [
            { text: "error", regex: false, caseSensitive: false },
            { text: "critical", regex: false, caseSensitive: false }
        ];
        expect(checkMatch(log, filters)).toBe(false);
    });

    test("should match numeric log values when converted to string", () => {
        const log = { id: 12345 };
        const filters = [{ text: "123", regex: false, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should handle undefined or null log values gracefully", () => {
        const log = { message: null, level: undefined };
        const filters = [{ text: "null", regex: false, caseSensitive: false }];
        // String(null) becomes "null", so the filter should match.
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should correctly match a complex regex pattern", () => {
        const log = { message: "Testing log with special characters: *+?^$" };
        const filters = [{ text: "Testing log with", regex: true, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(true);
    });

    test("should return false when the log object is empty and a filter is provided", () => {
        const log = {};
        const filters = [{ text: "anything", regex: false, caseSensitive: false }];
        expect(checkMatch(log, filters)).toBe(false);
    });
});
