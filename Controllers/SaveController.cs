using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.IO;

[Route("[controller]")]
[ApiController]
public class SaveController : ControllerBase
{
    public class FolderPathRequest
    {
        public string Path { get; set; }
    }

    [HttpPost]
    public ActionResult<IEnumerable<string>> GetFiles([FromBody] FolderPathRequest request)
    {
        try
        {
            if (!Directory.Exists(request.Path))
            {
                return NotFound("Directory does not exist.");
            }

            var files = Directory.GetFiles(request.Path);
            return Ok(files);
        }
        catch
        {
            return BadRequest("Error retrieving files.");
        }
    }
   [HttpPost("GetSaveData")]
    public IActionResult GetSaveData([FromBody] FolderPathRequest model)
    {
        try
        {
            byte[] fileBytes = System.IO.File.ReadAllBytes(model.Path);
            MemoryStream stream = new MemoryStream(fileBytes);
            return new FileStreamResult(stream, "application/octet-stream");
        }
        catch (Exception ex)
        {
            // Handle any exception that occurs during file reading
            return BadRequest(ex.Message);
        }
    }
    [HttpPost("OverwriteSaveData")]
    public IActionResult OverwriteSaveData([FromBody] SaveDataRequest requestData)
    {
        try
        {
            // Convert regular array back to byte array
            byte[] data = requestData.Data.ToArray();

            // Write to file (You need to implement the logic to securely locate and write to the file)
            System.IO.File.WriteAllBytes(requestData.Filename, data);

            return Ok(new { success = true });
        }
        catch(Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    public class SaveDataRequest
    {
        public string Filename { get; set; }
        public List<byte> Data { get; set; }
    }

}
