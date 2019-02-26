export class StringExtensions {
    //https://stackoverflow.com/a/29202760/1206959
    public static chunk(str : string, size: number) {
        const numChunks = Math.ceil(str.length / size);
        const chunks = new Array(numChunks);
      
        for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
          chunks[i] = str.substr(o, size);
        }
      
        return chunks;
      }
}