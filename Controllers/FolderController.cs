using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

[ApiController]
[Route("[controller]")]
public class FoldersController : ControllerBase
{
    private const string BaseFolderPath = "wwwroot/folders";



    [HttpPost("{folderName}")]
    public async Task<IActionResult> SaveFolder(string folderName, [FromBody] Folder folderData)
    {
        if (string.IsNullOrWhiteSpace(folderName))
            return BadRequest("Invalid folder name.");

        var folderPath = Path.Combine(BaseFolderPath, $"{folderName}.json");

        var jsonContent = JsonSerializer.Serialize(folderData);

        await System.IO.File.WriteAllTextAsync(folderPath, jsonContent);

        return Ok($"Folder {folderName} saved successfully.");
    }

    [HttpGet("{folderName}")]
    public async Task<IActionResult> GetFolder(string folderName)
    {
        var folderPath = Path.Combine(BaseFolderPath, $"{folderName}.json");

        if (!System.IO.File.Exists(folderPath))
            return NotFound($"Folder {folderName} not found.");

        var fileContent = await System.IO.File.ReadAllTextAsync(folderPath);

        return Content(fileContent, "application/json");
    }

    [HttpGet]
    public IActionResult ListFolders()
    {
        var files = Directory.GetFiles(BaseFolderPath, "*.json");
        var folderNames = new List<string>();

        foreach (var file in files)
        {
            folderNames.Add(Path.GetFileNameWithoutExtension(file));
        }

        return Ok(folderNames);
    }

    [HttpDelete("{folderName}")]
    public IActionResult DeleteFolder(string folderName)
    {
        var folderPath = Path.Combine(BaseFolderPath, $"{folderName}.json");

        if (!System.IO.File.Exists(folderPath))
            return NotFound($"Folder {folderName} not found.");

        System.IO.File.Delete(folderPath);

        return Ok($"Folder {folderName} deleted successfully.");
    }

    public class RawChipData
    {
        public int Id { get; set; }
        public int Code { get; set; }
    }

    public class Folder{
        public int Regged { get; set; }
        public List<int> Tagged { get; set; }
        public List<RawChipData> RawChips { get; set; }
    }
}
