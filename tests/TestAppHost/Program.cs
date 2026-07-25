using Mabhas19.Shared;

namespace Mabhas19.TestAppHost;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = DistributedApplication.CreateBuilder(args);

        builder.AddSqlServer(Services.DatabaseServer)
            .AddDatabase(Services.Database);

        builder.Build().Run();
    }
}