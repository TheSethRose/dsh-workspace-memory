// Offline, synthetic-data model evaluation only. Not enabled in the Host plugin.
// This does not request or download model assets and exposes no HTTP service.
import Foundation
import NaturalLanguage

let input = FileHandle.standardInput.readDataToEndOfFile()
let texts = try JSONDecoder().decode([String].self, from: input)
guard let embedding = NLEmbedding.sentenceEmbedding(for: .english) else {
    FileHandle.standardError.write(Data("Installed English sentence embedding unavailable.\n".utf8))
    exit(2)
}
let start = DispatchTime.now().uptimeNanoseconds
let vectors = texts.map { embedding.vector(for: $0) }
let elapsed = Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
let result: [String: Any] = [
    "model": "apple-naturallanguage-sentence-en",
    "revision": embedding.revision,
    "dimensions": embedding.dimension,
    "texts": texts.count,
    "inferenceMs": elapsed,
    "vectors": vectors.map { vector -> Any in if let vector { return vector }; return NSNull() }
]
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]))
